// Pruebas de seguridad de datos.
// Ejecuta las migraciones en un Postgres embebido (PGlite) y comprueba que cada paciente solo ve y cambia lo suyo.
// Uso: npm ci && npm run test:rls
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const db = new PGlite();
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create role authenticated;
create role anon;
grant usage on schema public to authenticated;
-- Como en Supabase: lo que se crea en public queda permitido a anon y authenticated salvo que una migración lo revoque
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, anon;
alter default privileges in schema public grant execute on functions to authenticated, anon;
-- Como en Supabase Storage: buckets y objetos con seguridad por filas activada
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
`);
const dir = new URL('../migrations/', import.meta.url);
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(fs.readFileSync(new URL(f, dir), 'utf8'));
  console.log(`Migración aplicada: ${f}`);
}

const coach = '11111111-1111-1111-1111-111111111111';
const p1 = '22222222-2222-2222-2222-222222222222';
const p2 = '33333333-3333-3333-3333-333333333333';
await db.exec(`
insert into auth.users values ('${coach}','c@x'),('${p1}','p1@x'),('${p2}','p2@x');
insert into profiles (id, role, full_name, email) values ('${coach}','coach','Coach','c@x'),('${p1}','patient','P1','p1@x'),('${p2}','patient','P2','p2@x');
insert into consents (patient_id, version) values ('${p1}','prueba'),('${p2}','prueba');
-- Como el alta real (función alta-paciente): todo paciente nuevo tiene el módulo de entrenamiento
insert into patient_modules (patient_id, module_slug) values ('${p1}','training'),('${p2}','training');
insert into exercises (name) values ('Sentadilla');
insert into templates (name) values ('Fuerza A');
insert into template_blocks (template_id, position) select id, 1 from templates;
insert into template_items (block_id, position, exercise_id, sets, rest_seconds) select b.id,1,e.id,3,90 from template_blocks b, exercises e where e.name = 'Sentadilla';
`);

const as = async (uid, sql, role = 'authenticated', claims = '') => {
  await db.exec(`reset role; set request.jwt.sub = '${uid}'; set request.jwt.claims = '${claims}'; set role ${role};`);
  try { return { rows: (await db.query(sql)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
};

let fails = 0;
const mfa = (uid, sql) => as(uid, sql, 'authenticated', '{"aal":"aal2"}');
const check = (name, ok) => { console.log(`${ok ? 'OK   ' : 'FALLO'} ${name}`); if (!ok) fails++; };

const tpl = `(select id from templates limit 1)`;
check('El coach puede asignar una plantilla', !(await as(coach, `select assign_template(${tpl}, '${p1}', current_date)`)).error);
check('El paciente 1 ve su entrenamiento', (await as(p1, 'select count(*)::int n from workouts')).rows[0].n === 1);
check('El paciente 2 no ve entrenamientos ajenos', (await as(p2, 'select count(*)::int n from workouts')).rows[0].n === 0);
const prof = (await as(p2, 'select full_name from profiles')).rows;
check('El paciente 2 solo ve su propio perfil', prof.length === 1 && prof[0].full_name === 'P2');
const item = (await db.query('select id from workout_items limit 1')).rows[0].id;
check('El paciente 1 registra una serie suya', !(await as(p1, `insert into set_logs (workout_item_id, patient_id, set_number, reps, load_kg) values ('${item}','${p1}',1,10,40)`)).error);
check('El paciente 2 no puede registrar series en un entrenamiento ajeno', !!(await as(p2, `insert into set_logs (workout_item_id, patient_id, set_number, reps) values ('${item}','${p2}',2,10)`)).error);
check('Un paciente no puede hacerse coach', !!(await as(p1, `update profiles set role='coach' where id='${p1}'`)).error);
check('Un paciente puede cambiar su nombre', !(await as(p1, `update profiles set full_name='Paciente Uno' where id='${p1}'`)).error);
check('Un paciente no puede asignar plantillas', !!(await as(p1, `select assign_template(${tpl}, '${p1}', current_date)`)).error);
check('Un paciente no ve las notas privadas del coach', (await as(p1, 'select count(*)::int n from coach_notes')).rows[0].n === 0);
check('Un paciente ve los cinco pilares', (await as(p1, 'select count(*)::int n from pillars')).rows[0].n === 5);
check('Los cinco pilares tienen su frase', (await as(p1, 'select count(*)::int n from pillars where description is not null')).rows[0].n === 5);
check('Un paciente no puede cambiar la frase de un pilar', !(await as(p1, "update pillars set description = 'x' where slug = 'movimiento-inteligente' returning id")).rows?.length);
check('El paciente 1 guarda sus ajustes', !(await as(p1, `insert into patient_settings (patient_id, city) values ('${p1}', 'Valencia')`)).error);
check('El paciente 2 no ve los ajustes del paciente 1', (await as(p2, 'select count(*)::int n from patient_settings')).rows[0].n === 0);
check('El coach ve todos los perfiles', (await as(coach, 'select count(*)::int n from profiles')).rows[0].n === 3);
check('Sin iniciar sesión no se ve ningún dato', (await as('', 'select (select count(*) from profiles) + (select count(*) from pillars) + (select count(*) from workouts) as n', 'anon')).rows[0].n == 0);

check('La biblioteca trae los 156 ejercicios del canal', (await as(coach, "select count(*)::int n from exercises where video_provider = 'youtube'")).rows[0].n === 156);
check('Un paciente activo ve la biblioteca', (await as(p1, 'select count(*)::int n from exercises')).rows[0].n > 150);
check('Un paciente no puede crear ejercicios', !!(await as(p1, "insert into exercises (name) values ('Ejercicio pirata')")).error);
check('Un paciente no puede cambiar un ejercicio', !(await as(p1, "update exercises set name = 'x' where video_id = 'qygWuOFVg7g' returning id")).rows?.length);
check('El coach puede renombrar un ejercicio', (await as(coach, "update exercises set name = 'Landmine pull + push (caballero)' where video_id = 'qygWuOFVg7g' returning id")).rows?.length === 1);
check('No se puede añadir dos veces el mismo vídeo', !!(await as(coach, "insert into exercises (name, video_provider, video_id) values ('Copia', 'youtube', 'qygWuOFVg7g')")).error);
await db.exec(`reset role; set request.jwt.sub = ''; update profiles set status = 'paused' where id = '${p2}'`);
check('Un paciente en pausa no ve la biblioteca', (await as(p2, 'select count(*)::int n from exercises')).rows[0].n === 0);
await db.exec(`reset role; set request.jwt.sub = ''; update profiles set status = 'active' where id = '${p2}'`);
check('Un paciente sigue sin poder cambiar su estado', !!(await as(p1, `update profiles set status = 'archived' where id = '${p1}'`)).error);

// ---------- Plantillas, asignación, copia de semana y registro (0006) ----------
const ex2 = (await db.query("select id from exercises where video_id = '_hpras2Fn5o'")).rows[0].id;
const tplJson = JSON.stringify({ name: 'Fuerza B', blocks: [
  { name: 'Calentamiento', type: 'normal', rounds: 1, items: [{ exercise_id: ex2, sets: 2, target: '10 reps', load_kg: 8, rest_seconds: 60 }] },
  { name: 'Bloque principal', type: 'superset', rounds: 3, items: [{ exercise_id: ex2, sets: 3, target: '8-10 reps', load_kg: 12, rest_seconds: 90 }] }
]}).replace(/'/g, "''");
const saved = await as(coach, `select save_template('${tplJson}'::jsonb) as id`);
check('El coach guarda una plantilla completa de una vez', !saved.error && !!saved.rows[0].id);
const tplB = saved.rows?.[0]?.id;
check('La plantilla tiene sus 2 bloques y 2 ejercicios', (await db.query(`select count(*)::int n from template_items i join template_blocks b on b.id = i.block_id where b.template_id = '${tplB}'`)).rows[0].n === 2);
const resaved = await as(coach, `select save_template('${tplJson.replace('Fuerza B', 'Fuerza B2').replace('{"name"', `{"id":"${tplB}","name"`)}'::jsonb) as id`);
check('Editar la plantilla la reemplaza sin duplicar bloques', resaved.rows?.[0]?.id === tplB && (await db.query(`select count(*)::int n from template_blocks where template_id = '${tplB}'`)).rows[0].n === 2);
check('Un paciente no puede guardar plantillas', !!(await as(p1, `select save_template('{"name":"x","blocks":[]}'::jsonb)`)).error);
const lunes = `date_trunc('week', current_date)::date`;
const asig = await as(coach, `select assign_template('${tplB}', '${p1}', ${lunes} + 2, 'Ve con calma') as id`);
check('Asignar copia también la carga pautada', !asig.error && (await db.query(`select count(*)::int n from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${asig.rows[0].id}' and i.load_kg = 12`)).rows[0].n === 1);
check('No se puede asignar a alguien que no es paciente', !!(await as(coach, `select assign_template('${tplB}', '${coach}', current_date)`)).error);
const wB = asig.rows[0].id;
check('El paciente marca su entrenamiento como hecho con esfuerzo', !(await as(p1, `update workouts set status = 'completed', rpe = 7, feeling = 'bien', completed_at = now() where id = '${wB}'`)).error);
check('El paciente no puede cambiar la fecha de su entrenamiento', !!(await as(p1, `update workouts set scheduled_date = scheduled_date + 1 where id = '${wB}'`)).error);
check('El paciente no puede cambiar el mensaje del coach', !!(await as(p1, `update workouts set coach_message = 'x' where id = '${wB}'`)).error);
const copia = await as(coach, `select copy_week('${p1}', ${lunes}, ${lunes} + 7) as n`);
check('Copiar semana crea las sesiones en la semana siguiente', !copia.error && copia.rows[0].n >= 1 && (await db.query(`select count(*)::int n from workouts where patient_id = '${p1}' and scheduled_date = ${lunes} + 9 and status = 'scheduled'`)).rows[0].n === 1);
check('Un paciente no puede copiar semanas', !!(await as(p1, `select copy_week('${p1}', ${lunes}, ${lunes} + 14)`)).error);
const itemB = (await db.query(`select i.id from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${wB}' limit 1`)).rows[0].id;
check('El paciente deja una nota y marca "no puedo" con motivo', !(await as(p1, `insert into workout_item_feedback (workout_item_id, patient_id, note, cannot_do, reason) values ('${itemB}', '${p1}', 'Molestia en la rodilla', true, 'pain')`)).error);
check('Otro paciente no ve esa nota', (await as(p2, 'select count(*)::int n from workout_item_feedback')).rows[0].n === 0);
check('Otro paciente no puede dejar notas en ejercicios ajenos', !!(await as(p2, `insert into workout_item_feedback (workout_item_id, patient_id, note) values ('${itemB}', '${p2}', 'x')`)).error);
check('El paciente no puede marcar su nota como leída', !!(await as(p1, `update workout_item_feedback set read_by_coach_at = now() where workout_item_id = '${itemB}'`)).error);
check('El coach ve la nota y la marca como leída', !(await as(coach, `update workout_item_feedback set read_by_coach_at = now() where workout_item_id = '${itemB}'`)).error);

check('Copiar la misma semana otra vez no duplica sesiones', !(await as(coach, `select copy_week('${p1}', ${lunes}, ${lunes} + 7)`)).error && (await db.query(`select count(*)::int n from workouts where patient_id = '${p1}' and scheduled_date = ${lunes} + 9`)).rows[0].n === 1);
check('No se puede copiar una semana sobre sí misma', !!(await as(coach, `select copy_week('${p1}', ${lunes}, ${lunes})`)).error);
check('Renombrar una plantilla sin enviar bloques no borra su contenido', (await as(coach, `select save_template('{"id":"${tplB}","name":"Fuerza B renombrada"}'::jsonb)`)).rows?.length === 1 && (await db.query(`select count(*)::int n from template_blocks where template_id = '${tplB}'`)).rows[0].n === 2);
const itemOtro = (await db.query(`select i.id from workout_items i join workout_blocks b on b.id = i.block_id join workouts w on w.id = b.workout_id where w.patient_id = '${p1}' and i.id <> '${itemB}' limit 1`)).rows[0].id;
await as(p1, `insert into workout_item_feedback (workout_item_id, patient_id, note, read_by_coach_at) values ('${itemOtro}', '${p1}', 'hola', now())`);
check('Una nota nueva del paciente siempre llega sin leer', (await db.query(`select read_by_coach_at from workout_item_feedback where workout_item_id = '${itemOtro}'`)).rows[0].read_by_coach_at === null);
await db.exec(`reset role; set request.jwt.sub = ''; update profiles set status = 'paused' where id = '${p2}'`);
check('Un paciente en pausa no puede cambiar su perfil', !(await as(p2, `update profiles set full_name = 'x' where id = '${p2}' returning id`)).rows?.length);
await db.exec(`reset role; set request.jwt.sub = ''; update profiles set status = 'active' where id = '${p2}'`);
check('No se puede repetir un email cambiando mayúsculas', !!(await as(coach, `update profiles set email = 'P1@X' where id = '${p2}'`)).error);

// ---------- Programas (0007) ----------
const tplA = (await db.query(`select id from templates where name = 'Fuerza A'`)).rows[0].id;
const progJson = JSON.stringify({ name: 'Fuerza base', weeks: 3,
  week_rules: [{ week_number: 1, load_change_pct: 0 }, { week_number: 2, load_change_pct: 10, note: 'Sube un poco la carga.' }, { week_number: 3, load_change_pct: -20, note: 'Semana de descarga.' }],
  slots: [1, 2, 3].flatMap((w) => [{ week_number: w, day_of_week: 1, template_id: tplB }, { week_number: w, day_of_week: 3, template_id: tplA }]) });
const prog = await as(coach, `select save_program('${progJson}'::jsonb) as id`);
check('El coach guarda un programa de 3 semanas', !prog.error && !!prog.rows[0].id);
const progId = prog.rows?.[0]?.id;
check('Un paciente no puede guardar programas', !!(await as(p2, `select save_program('{"name":"x","weeks":1}'::jsonb)`)).error);
check('Un programa no puede pasar de 12 semanas', !!(await as(coach, `select save_program('{"name":"x","weeks":13}'::jsonb)`)).error);
const lunesPasado = `date_trunc('week', current_date)::date - 7`;
check('Un programa solo puede empezar en lunes', !!(await as(coach, `select assign_program('${progId}', '${p2}', ${lunesPasado} + 1)`)).error);
const asig2 = await as(coach, `select assign_program('${progId}', '${p2}', ${lunesPasado}, 'Vamos.') as id`);
check('Asignar el programa crea sus 6 sesiones', !asig2.error && (await db.query(`select count(*)::int n from workouts where program_assignment_id = '${asig2.rows[0].id}'`)).rows[0].n === 6);
const aId = asig2.rows?.[0]?.id;
const cargaSemana = async (w) => (await db.query(`select i.load_kg::float x from workout_items i join workout_blocks b on b.id = i.block_id join workouts wo on wo.id = b.workout_id where wo.program_assignment_id = '${aId}' and wo.program_week = ${w} and wo.name like 'Fuerza B%' and i.load_kg is not null order by i.load_kg desc limit 1`)).rows[0].x;
check('La progresión ajusta la carga por semana (12 → 13 → 9,5 kg)', (await cargaSemana(1)) === 12 && (await cargaSemana(2)) === 13 && (await cargaSemana(3)) === 9.5);
check('La nota de la semana llega al paciente', (await db.query(`select coach_message from workouts where program_assignment_id = '${aId}' and program_week = 2 limit 1`)).rows[0].coach_message === 'Vamos. Sube un poco la carga.');
check('Un paciente no puede asignar programas', !!(await as(p2, `select assign_program('${progId}', '${p2}', ${lunesPasado})`)).error);
check('Nadie puede llamar desde la app a la copia interna', !!(await as(coach, `select _copy_template_to_workout('${tplA}', '${p2}', current_date, null, 0, null, null)`)).error);
check('El paciente ve su programa y su nombre', (await as(p2, 'select p.name from program_assignments a join programs p on p.id = a.program_id')).rows?.[0]?.name === 'Fuerza base');
check('Otro paciente no ve ese programa', (await as(p1, 'select count(*)::int n from programs')).rows[0].n === 0);
const w = async (week, day) => (await db.query(`select id from workouts where program_assignment_id = '${aId}' and scheduled_date = ${lunesPasado} + ${(week - 1) * 7 + day - 1}`)).rows[0].id;
const s21 = await w(2, 1), s23 = await w(2, 3), s31 = await w(3, 1), s33 = await w(3, 3);
await as(p2, `update workouts set status = 'completed', rpe = 6 where id = '${s21}'`);
const it23 = (await db.query(`select i.id from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${s23}' limit 1`)).rows[0].id;
await as(p2, `insert into set_logs (workout_item_id, patient_id, set_number, reps) values ('${it23}', '${p2}', 1, 8)`);
const it31 = (await db.query(`select i.id from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${s31}' limit 1`)).rows[0].id;
await as(p2, `insert into workout_item_feedback (workout_item_id, patient_id, note) values ('${it31}', '${p2}', 'Ojo rodilla')`);
check('El paciente no puede cambiar la semana de programa de una sesión', !!(await as(p2, `update workouts set program_week = 1 where id = '${s33}'`)).error);
check('No se puede cambiar el programa desde una semana pasada', !!(await as(coach, `select replace_program_from_week('${aId}', 1, '${progId}')`)).error);
check('Un paciente no puede cambiar programas', !!(await as(p2, `select replace_program_from_week('${aId}', 2, null)`)).error);
const cambio = await as(coach, `select replace_program_from_week('${aId}', 2, '${progId}', null) as r`);
const r = cambio.rows?.[0]?.r;
check('Cambiar desde la semana 2 quita solo la sesión pendiente sin registros', !cambio.error && r.removed === 1 && r.kept === 3);
check('Nunca se borran sesiones hechas, con series o con notas', (await db.query(`select count(*)::int n from workouts where id in ('${s21}', '${s23}', '${s31}')`)).rows[0].n === 3 && (await db.query(`select count(*)::int n from workouts where id = '${s33}'`)).rows[0].n === 0);
check('El nuevo programa empieza ese mismo lunes', (await db.query(`select start_date = ${lunesPasado} + 7 as ok from program_assignments where id = '${r?.new_assignment}'`)).rows[0]?.ok === true);
check('El programa anterior queda como sustituido', (await db.query(`select status::text s, replaced_from_week n from program_assignments where id = '${aId}'`)).rows[0].s === 'replaced');
check('Un programa sustituido no se puede volver a cambiar', !!(await as(coach, `select replace_program_from_week('${aId}', 3, null)`)).error);

// 0008: sesiones a medida
const exS = (await db.query("select id from exercises where name = 'Sentadilla'")).rows[0].id;
const bloquesS = JSON.stringify([{ name: 'Principal', type: 'normal', rounds: 1, items: [{ exercise_id: exS, sets: 4, target: '6-8', load_kg: '20', rest_seconds: 90, instructions: 'Sin dolor' }] }, { name: 'Vacío', items: [] }]);
const nueva = await as(coach, `select save_workout(jsonb_build_object('patient_id','${p2}','name','Fuerza Laura','coach_message','A tope','dates', jsonb_build_array(current_date + 1, current_date + 4, current_date + 1),'blocks','${bloquesS}'::jsonb)) as r`);
const idsS = nueva.rows?.[0]?.r?.ids ?? [];
check('Crear una sesión a medida en dos días crea dos sesiones (sin duplicar fechas)', !nueva.error && idsS.length === 2);
check('La sesión a medida guarda series, carga e indicación', (await db.query(`select i.sets, i.load_kg::float kg, i.instructions from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${idsS[0]}'`)).rows[0]?.kg === 20);
check('Los bloques vacíos no se guardan', (await db.query(`select count(*)::int n from workout_blocks where workout_id = '${idsS[0]}'`)).rows[0].n === 1);
check('El paciente ve su sesión a medida', (await as(p2, `select count(*)::int n from workouts where id = '${idsS[0]}'`)).rows[0].n === 1);
check('Un paciente no puede crear sesiones', !!(await as(p2, `select save_workout(jsonb_build_object('patient_id','${p2}','name','x','dates', jsonb_build_array(current_date),'blocks','${bloquesS}'::jsonb))`)).error);
check('No se puede crear una sesión para el coach', !!(await as(coach, `select save_workout(jsonb_build_object('patient_id','${coach}','name','x','dates', jsonb_build_array(current_date),'blocks','${bloquesS}'::jsonb))`)).error);
check('Una sesión sin ejercicios no se guarda', !!(await as(coach, `select save_workout(jsonb_build_object('patient_id','${p2}','name','x','dates', jsonb_build_array(current_date),'blocks','[]'::jsonb))`)).error);
check('Nadie puede llamar desde la app al relleno interno', !!(await as(coach, `select _fill_workout('${idsS[0]}', '${bloquesS}'::jsonb)`)).error);
const editar = await as(coach, `select save_workout(jsonb_build_object('id','${idsS[0]}','name','Fuerza Laura v2','blocks','${bloquesS.replace('"sets":4', '"sets":5')}'::jsonb))`);
check('El coach puede editar una sesión pendiente', !editar.error && (await db.query(`select w.name, i.sets from workouts w join workout_blocks b on b.workout_id = w.id join workout_items i on i.block_id = b.id where w.id = '${idsS[0]}'`)).rows[0]?.sets === 5);
check('Editar no cambia la otra sesión', (await db.query(`select i.sets from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${idsS[1]}'`)).rows[0].sets === 4);
const itS = (await db.query(`select i.id from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${idsS[1]}'`)).rows[0].id;
await as(p2, `insert into workout_item_feedback (workout_item_id, patient_id, note) values ('${itS}', '${p2}', 'Me molesta')`);
check('No se puede editar una sesión con notas del paciente', !!(await as(coach, `select save_workout(jsonb_build_object('id','${idsS[1]}','name','x','blocks','${bloquesS}'::jsonb))`)).error);
check('La nota del paciente sigue intacta', (await db.query(`select count(*)::int n from workout_item_feedback where workout_item_id = '${itS}'`)).rows[0].n === 1);
await as(p2, `update workouts set status = 'completed' where id = '${idsS[0]}'`);
check('No se puede editar una sesión hecha', !!(await as(coach, `select save_workout(jsonb_build_object('id','${idsS[0]}','name','x','blocks','${bloquesS}'::jsonb))`)).error);

// 0009: consentimiento
const p3 = '44444444-4444-4444-4444-444444444444';
await db.exec(`reset role; set request.jwt.sub = ''; insert into auth.users values ('${p3}','p3@x'); insert into profiles (id, role, full_name, email) values ('${p3}','patient','P3','p3@x'); insert into patient_modules (patient_id, module_slug) values ('${p3}','training');`);
await as(coach, `select assign_template(${tpl}, '${p3}', current_date)`);
check('Sin consentimiento, el paciente ve su perfil (para poder aceptarlo)', (await as(p3, 'select count(*)::int n from profiles')).rows[0].n === 1);
check('Sin consentimiento, el paciente no ve sus entrenamientos', (await as(p3, 'select count(*)::int n from workouts')).rows[0].n === 0);
check('Sin consentimiento, el paciente no ve los pilares', (await as(p3, 'select count(*)::int n from pillars')).rows[0].n === 0);
check('El paciente no puede escribir el consentimiento a mano', !!(await as(p3, `insert into consents (patient_id, version) values ('${p3}', 'x')`)).error);
check('El coach no puede aceptar en nombre del paciente', !!(await as(coach, `select accept_consent('1.0')`)).error);
check('El paciente acepta el consentimiento', !(await as(p3, `select accept_consent('1.0', 'Prueba')`)).error);
check('Con consentimiento, ve sus entrenamientos', (await as(p3, 'select count(*)::int n from workouts')).rows[0].n === 1);
check('Aceptar la misma versión dos veces no duplica', !(await as(p3, `select accept_consent('1.0')`)).error && (await db.query(`select count(*)::int n from consents where patient_id = '${p3}'`)).rows[0].n === 1);
await as(p3, `select accept_consent('1.1')`);
check('Una versión nueva sustituye a la anterior', (await db.query(`select count(*) filter (where replaced_at is null and withdrawn_at is null)::int a, count(*)::int t from consents where patient_id = '${p3}'`)).rows[0].a === 1);
check('El paciente no puede borrar su registro de consentimiento', !(await as(p3, `delete from consents where patient_id = '${p3}' returning id`)).rows?.length);
check('El paciente no puede cambiar la fecha de aceptación', !(await as(p3, `update consents set accepted_at = now() - interval '1 year' returning id`)).rows?.length);
check('Otro paciente no ve ese consentimiento', (await as(p1, `select count(*)::int n from consents where patient_id = '${p3}'`)).rows[0].n === 0);
check('El coach ve el consentimiento', (await as(coach, `select count(*)::int n from consents where patient_id = '${p3}'`)).rows[0].n === 2);
check('El paciente retira su consentimiento', (await as(p3, 'select withdraw_consent() as r')).rows?.[0]?.r === true);
check('Tras retirarlo, ya no ve sus entrenamientos', (await as(p3, 'select count(*)::int n from workouts')).rows[0].n === 0);
const wP3 = (await db.query(`select i.id from workout_items i join workout_blocks b on b.id = i.block_id join workouts w on w.id = b.workout_id where w.patient_id = '${p3}' limit 1`)).rows[0].id;
check('Tras retirarlo, no puede registrar series', !!(await as(p3, `insert into set_logs (workout_item_id, patient_id, set_number, reps) values ('${wP3}', '${p3}', 1, 5)`)).error);
check('Nadie puede llamar desde la app a la comprobación interna', !!(await as(p3, 'select _is_patient_account_active()')).error);
await db.exec(`reset role; set request.jwt.sub = ''; update profiles set status = 'paused' where id = '${p3}'`);
check('Un paciente en pausa no puede aceptar', !!(await as(p3, `select accept_consent('1.1')`)).error);

// 0010: cambiar un ejercicio en todo el plan
await db.exec(`reset role; set request.jwt.sub = ''; insert into exercises (name) values ('Ejercicio sustituto prueba'), ('Ejercicio archivado prueba') ; update exercises set is_archived = true where name = 'Ejercicio archivado prueba';`);
const exA = (await db.query("select id from exercises where name = 'Sentadilla'")).rows[0].id;
const exB = (await db.query("select id from exercises where name = 'Ejercicio sustituto prueba'")).rows[0].id;
const exArch = (await db.query("select id from exercises where name = 'Ejercicio archivado prueba'")).rows[0].id;
const bloq = JSON.stringify([{ name: 'P', items: [{ exercise_id: exA, sets: 3, target: '10', load_kg: '20', rest_seconds: 60, instructions: 'Baja lento' }] }]);
const cx = await as(coach, `select save_workout(jsonb_build_object('patient_id','${p1}','name','Cambio','dates', jsonb_build_array(current_date + 1, current_date + 2, current_date + 3),'blocks','${bloq}'::jsonb)) as r`);
const [c1, c2, c3] = cx.rows[0].r.ids;
const itC2 = (await db.query(`select i.id from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${c2}'`)).rows[0].id;
await as(p1, `insert into set_logs (workout_item_id, patient_id, set_number, reps) values ('${itC2}', '${p1}', 1, 10)`);
await db.exec(`reset role; set request.jwt.sub = ''; update workouts set status = 'completed' where id = '${c3}'`);
check('Un paciente no puede cambiar ejercicios', !!(await as(p1, `select replace_exercise('${p1}', '${exA}', '${exB}')`)).error);
check('No se puede cambiar por un ejercicio archivado', !!(await as(coach, `select replace_exercise('${p1}', '${exA}', '${exArch}')`)).error);
const esperados = (await db.query(`select count(*)::int n from workout_items i join workout_blocks b on b.id = i.block_id join workouts w on w.id = b.workout_id where w.patient_id = '${p1}' and w.status = 'scheduled' and w.scheduled_date >= current_date + 1 and i.exercise_id = '${exA}' and not exists (select 1 from set_logs l where l.workout_item_id = i.id) and not exists (select 1 from workout_item_feedback f where f.workout_item_id = i.id)`)).rows[0].n;
const rx = await as(coach, `select replace_exercise('${p1}', '${exA}', '${exB}', current_date + 1, 8, false, null) as n`);
check('Cambiar ejercicio toca solo las sesiones pendientes sin registros', !rx.error && rx.rows[0].n === esperados && esperados >= 1);
const ejDe = async (w) => (await db.query(`select i.exercise_id, i.load_kg::float kg, i.instructions, i.sets from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${w}'`)).rows[0];
const r1 = await ejDe(c1);
check('El ejercicio nuevo mantiene series y aplica la carga nueva', r1.exercise_id === exB && r1.kg === 8 && r1.sets === 3 && r1.instructions === 'Baja lento');
check('No cambia la sesión con series registradas', (await ejDe(c2)).exercise_id === exA);
check('No cambia la sesión hecha', (await ejDe(c3)).exercise_id === exA);
check('No cambia sesiones de otros pacientes', (await db.query(`select count(*)::int n from workout_items i join workout_blocks b on b.id = i.block_id join workouts w on w.id = b.workout_id where w.patient_id <> '${p1}' and i.exercise_id = '${exB}'`)).rows[0].n === 0);

// 0011: medidas
check('El paciente anota sus medidas', !(await as(p1, `insert into body_measurements (patient_id, weight_kg, waist_cm) values ('${p1}', 72.5, 81)`)).error);
check('Anotar otra vez el mismo día actualiza', !(await as(p1, `insert into body_measurements (patient_id, weight_kg) values ('${p1}', 72) on conflict (patient_id, measured_on) do update set weight_kg = excluded.weight_kg`)).error && (await db.query(`select count(*)::int n, max(weight_kg)::float w from body_measurements where patient_id = '${p1}'`)).rows[0].w === 72);
check('No se pueden anotar medidas vacías', !!(await as(p1, `insert into body_measurements (patient_id, measured_on) values ('${p1}', current_date - 1)`)).error);
check('No se puede anotar una fecha futura', !!(await as(p1, `insert into body_measurements (patient_id, measured_on, weight_kg) values ('${p1}', current_date + 1, 70)`)).error);
check('No se aceptan valores imposibles', !!(await as(p1, `insert into body_measurements (patient_id, measured_on, weight_kg) values ('${p1}', current_date - 2, 900)`)).error);
check('Un paciente no puede anotar medidas de otro', !!(await as(p2, `insert into body_measurements (patient_id, weight_kg) values ('${p1}', 60)`)).error);
check('Otro paciente no ve esas medidas', (await as(p2, 'select count(*)::int n from body_measurements')).rows[0].n === 0);
check('El coach ve las medidas', (await as(coach, `select count(*)::int n from body_measurements where patient_id = '${p1}'`)).rows[0].n === 1);
check('Sin consentimiento no puede anotar medidas', !!(await as(p3, `insert into body_measurements (patient_id, weight_kg) values ('${p3}', 60)`)).error);

// 0012: mensajes
{ const r0 = await as(p1, `insert into messages (patient_id, sender_id, body) values ('${p1}', '${p1}', 'Hola Rubén')`); check('El paciente escribe a su coach', !r0.error); }
// !(await as(p1, `insert into messages (patient_id, sender_id, body) values ('${p1}', '${p1}', 'Hola Rubén')`)).error);
check('Un mensaje nuevo siempre llega sin leer', !(await as(p1, `insert into messages (patient_id, sender_id, body, read_at) values ('${p1}', '${p1}', 'Truco', now())`)).error && (await db.query(`select count(*)::int n from messages where body = 'Truco' and read_at is null`)).rows[0].n === 1);
check('El paciente no puede hacerse pasar por el coach', (await as(p1, `insert into messages (patient_id, sender_id, body) values ('${p1}', '${coach}', 'Falso') returning sender_id`)).rows?.[0]?.sender_id !== coach);
check('Un paciente no puede escribir en otra conversación', !!(await as(p2, `insert into messages (patient_id, sender_id, body) values ('${p1}', '${p2}', 'Intruso')`)).error);
check('El coach responde', !(await as(coach, `insert into messages (patient_id, sender_id, body) values ('${p1}', '${coach}', 'Hola, dime')`)).error);
check('El coach no puede escribir en una conversación de otro coach o inexistente', !!(await as(coach, `insert into messages (patient_id, sender_id, body) values ('${coach}', '${coach}', 'x')`)).error);
check('El paciente ve solo su conversación', (await as(p1, 'select count(*)::int n from messages')).rows[0].n === 4 && (await as(p2, 'select count(*)::int n from messages')).rows[0].n === 0);
check('El paciente no puede editar mensajes', !(await as(p1, `update messages set body = 'cambiado' returning id`)).rows?.length);
check('El paciente no puede borrar mensajes', !(await as(p1, `delete from messages returning id`)).rows?.length);
check('El paciente marca como leído lo que recibe', (await as(p1, `select mark_messages_read('${p1}') as n`)).rows?.[0]?.n === 1 && (await db.query(`select count(*)::int n from messages where patient_id = '${p1}' and sender_id = '${p1}' and read_at is not null and body <> 'Truco'`)).rows[0].n === 0);
check('Un paciente no puede marcar la conversación de otro', !!(await as(p2, `select mark_messages_read('${p1}')`)).error);
check('El coach marca como leídos los del paciente', (await as(coach, `select mark_messages_read('${p1}') as n`)).rows?.[0]?.n === 3);
check('Sin consentimiento no se puede escribir', !!(await as(p3, `insert into messages (patient_id, sender_id, body) values ('${p3}', '${p3}', 'x')`)).error);

// 0013: correcciones de la revisión
{
  const bq = JSON.stringify([{ name: 'P', items: [{ exercise_id: exS, sets: 3, target: '10' }] }]);
  const ids = (await as(coach, `select save_workout(jsonb_build_object('patient_id','${p1}','name','Borrar','dates', jsonb_build_array(current_date + 5),'blocks','${bq}'::jsonb)) as r`)).rows[0].r.ids;
  const it = (await db.query(`select i.id from workout_items i join workout_blocks b on b.id = i.block_id where b.workout_id = '${ids[0]}'`)).rows[0].id;
  await as(p1, `insert into workout_item_feedback (workout_item_id, patient_id, note, cannot_do, reason) values ('${it}', '${p1}', null, true, 'pain')`);
  check('No se puede quitar del calendario una sesión con una nota de dolor', !!(await as(coach, `delete from workouts where id = '${ids[0]}'`)).error);
  check('La nota de dolor sigue ahí', (await db.query(`select count(*)::int n from workout_item_feedback where workout_item_id = '${it}'`)).rows[0].n === 1);
  await as(coach, `update workout_item_feedback set read_by_coach_at = now() where workout_item_id = '${it}'`);
  await as(p1, `update workout_item_feedback set note = 'Ahora me duele mucho' where workout_item_id = '${it}'`);
  check('Si el paciente cambia una nota leída, vuelve a estar sin leer', (await db.query(`select read_by_coach_at from workout_item_feedback where workout_item_id = '${it}'`)).rows[0].read_by_coach_at === null);
  check('Una sesión sin registros sí se puede quitar', !(await as(coach, `delete from workouts where id in (select id from workouts where name = 'Fuerza Laura v2' and status = 'scheduled')`)).error);
  check('La hora de España está disponible', (await db.query(`select hoy_local() is not null as ok`)).rows[0].ok === true);
}

// 0014: ritmos circadianos
check('Sin el módulo activo no se puede registrar sueño', !!(await as(p1, `insert into sleep_logs (patient_id, night_of, quality) values ('${p1}', current_date - 1, 4)`)).error);
await db.exec(`reset role; set request.jwt.sub = ''; insert into patient_modules (patient_id, module_slug) values ('${p1}', 'circadian')`);
check('Con el módulo activo, el paciente registra su noche', !(await as(p1, `insert into sleep_logs (patient_id, night_of, bedtime, wake_time, quality, rested) values ('${p1}', current_date - 1, (current_date - 1) + time '23:30', current_date + time '07:15', 4, 3)`)).error);
check('No se puede registrar una noche futura', !!(await as(p1, `insert into sleep_logs (patient_id, night_of, quality) values ('${p1}', current_date + 2, 4)`)).error);
check('No se acepta despertar antes de acostarse', !!(await as(p1, `insert into sleep_logs (patient_id, night_of, bedtime, wake_time) values ('${p1}', current_date - 3, (current_date - 3) + time '23:00', (current_date - 3) + time '22:00')`)).error);
check('El paciente anota una comida', !(await as(p1, `insert into meal_events (patient_id, eaten_at, kind) values ('${p1}', now() - interval '2 hours', 'lunch')`)).error);
check('No se anota una comida en el futuro', !!(await as(p1, `insert into meal_events (patient_id, eaten_at, kind) values ('${p1}', now() + interval '3 hours', 'dinner')`)).error);
check('Otro paciente no ve ese sueño ni esas comidas', (await as(p2, 'select (select count(*) from sleep_logs) + (select count(*) from meal_events) as n')).rows[0].n == 0);
check('Otro paciente no puede escribir en su nombre', !!(await as(p2, `insert into meal_events (patient_id, eaten_at) values ('${p1}', now())`)).error);
check('El coach ve el sueño y las comidas', (await as(coach, `select (select count(*) from sleep_logs where patient_id = '${p1}') + (select count(*) from meal_events where patient_id = '${p1}') as n`)).rows[0].n == 2);
check('El paciente guarda su ciudad', !(await as(p1, `insert into patient_settings (patient_id, city, latitude, longitude) values ('${p1}', 'Valencia', 39.47, -0.376) on conflict (patient_id) do update set city = excluded.city, latitude = excluded.latitude, longitude = excluded.longitude`)).error);

// 0015: hábitos
{
  const nCat = (await db.query(`select count(*)::int n from habit_definitions`)).rows[0].n;
  check('El catálogo inicial tiene hábitos de los cinco pilares', nCat >= 20 && (await db.query(`select count(distinct pillar_id)::int n from habit_definitions`)).rows[0].n === 5);
  const hab = (await db.query(`select id from habit_definitions where name = 'Luz natural al despertar'`)).rows[0].id;
  const hNum = (await db.query(`select id from habit_definitions where name = 'Pasos del día'`)).rows[0].id;
  check('Un paciente no puede asignarse hábitos', !!(await as(p1, `insert into patient_habits (patient_id, habit_id) values ('${p1}', '${hab}')`)).error);
  check('El coach asigna un hábito', !(await as(coach, `insert into patient_habits (patient_id, habit_id, target, coach_note) values ('${p1}', '${hab}', 15, 'Mejor en la terraza')`)).error);
  await as(coach, `insert into patient_habits (patient_id, habit_id) values ('${p2}', '${hNum}')`);
  const ph = (await db.query(`select id from patient_habits where patient_id = '${p1}'`)).rows[0].id;
  const ph2 = (await db.query(`select id from patient_habits where patient_id = '${p2}'`)).rows[0].id;
  check('Días de la semana fuera de rango no se aceptan', !!(await as(coach, `insert into patient_habits (patient_id, habit_id, days_of_week) values ('${p1}', '${hab}', '{0,8}')`)).error);
  check('Sin el módulo, el paciente no ve sus hábitos', (await as(p1, 'select count(*)::int n from patient_habits')).rows[0].n === 0);
  check('Sin el módulo, no puede marcar', !!(await as(p1, `insert into habit_logs (patient_habit_id, patient_id, log_date, done) values ('${ph}', '${p1}', current_date, true)`)).error);
  await db.exec(`reset role; set request.jwt.sub = ''; insert into patient_modules (patient_id, module_slug) values ('${p1}', 'habits'), ('${p2}', 'habits')`);
  check('Con el módulo, ve su hábito', (await as(p1, 'select count(*)::int n from patient_habits')).rows[0].n === 1);
  check('El paciente lee el catálogo', (await as(p1, 'select count(*)::int n from habit_definitions')).rows[0].n === nCat);
  check('Marca el hábito de hoy', !(await as(p1, `insert into habit_logs (patient_habit_id, patient_id, log_date, done, value_numeric) values ('${ph}', '${p1}', current_date, true, 12)`)).error);
  check('Puede cambiar lo de hoy', !(await as(p1, `update habit_logs set value_numeric = 20 where patient_habit_id = '${ph}' and log_date = current_date`)).error);
  check('No marca días futuros', !!(await as(p1, `insert into habit_logs (patient_habit_id, patient_id, log_date, done) values ('${ph}', '${p1}', current_date + 1, true)`)).error);
  check('No marca más de una semana atrás', !!(await as(p1, `insert into habit_logs (patient_habit_id, patient_id, log_date, done) values ('${ph}', '${p1}', current_date - 10, true)`)).error);
  check('No marca en un hábito de otro paciente', !!(await as(p1, `insert into habit_logs (patient_habit_id, patient_id, log_date, done) values ('${ph2}', '${p1}', current_date, true)`)).error);
  check('Otro paciente no ve sus registros', (await as(p2, 'select count(*)::int n from habit_logs')).rows[0].n === 0);
  check('El paciente no puede cambiar su objetivo', (await as(p1, `update patient_habits set target = 1 where id = '${ph}' returning id`)).rows?.length !== 1);
  check('Ni editar el catálogo', (await as(p1, `update habit_definitions set name = 'x' where id = '${hab}' returning id`)).rows?.length !== 1);
  await as(coach, `update patient_habits set is_active = false where id = '${ph}'`);
  check('Un hábito retirado ya no se puede marcar', !!(await as(p1, `insert into habit_logs (patient_habit_id, patient_id, log_date, done) values ('${ph}', '${p1}', current_date - 1, true)`)).error);
  check('El coach ve el registro', (await as(coach, `select count(*)::int n from habit_logs where patient_id = '${p1}'`)).rows[0].n === 1);
  check('El coach crea un hábito nuevo', !(await as(coach, `insert into habit_definitions (name, kind, rationale) values ('Ducha de contraste', 'check', 'Prueba')`)).error);
}

// 0016: documentos
{
  check('Existe el almacén privado de documentos', (await db.query(`select public from storage.buckets where id = 'documentos'`)).rows[0]?.public === false);
  const pil = `(select id from pillars where slug = 'alimentacion-consciente')`;
  check('El coach registra un documento', !(await as(coach, `insert into patient_documents (patient_id, pillar_id, title, storage_path, size_bytes) values ('${p1}', ${pil}, 'Plan de alimentación', '${p1}/plan.pdf', 1000)`)).error);
  await as(coach, `insert into patient_documents (patient_id, title, storage_path, is_shared) values ('${p1}', 'Borrador', '${p1}/borrador.pdf', false)`);
  await as(coach, `insert into patient_documents (patient_id, title, storage_path) values ('${p2}', 'De P2', '${p2}/p2.pdf')`);
  check('La ruta del archivo debe estar en la carpeta del paciente', !!(await as(coach, `insert into patient_documents (patient_id, title, storage_path) values ('${p1}', 'Mal', '${p2}/x.pdf')`)).error);
  check('Solo PDF', !!(await as(coach, `insert into patient_documents (patient_id, title, storage_path, mime) values ('${p1}', 'Foto', '${p1}/f.jpg', 'image/jpeg')`)).error);
  check('El coach sube el archivo', !(await as(coach, `insert into storage.objects (bucket_id, name) values ('documentos', '${p1}/plan.pdf'), ('documentos', '${p1}/borrador.pdf'), ('documentos', '${p2}/p2.pdf')`)).error);
  check('El paciente ve solo sus documentos compartidos', (await as(p1, 'select title from patient_documents')).rows.map(r => r.title).join() === 'Plan de alimentación');
  check('El paciente abre su archivo compartido y no el borrador ni el ajeno', (await as(p1, `select name from storage.objects`)).rows.map(r => r.name).join() === `${p1}/plan.pdf`);
  check('El paciente no puede subir archivos', !!(await as(p1, `insert into storage.objects (bucket_id, name) values ('documentos', '${p1}/mio.pdf')`)).error);
  check('El paciente no puede borrar archivos', (await as(p1, `delete from storage.objects where name = '${p1}/plan.pdf' returning id`)).rows?.length !== 1);
  check('El paciente no puede registrar documentos', !!(await as(p1, `insert into patient_documents (patient_id, title, storage_path) values ('${p1}', 'X', '${p1}/x.pdf')`)).error);
  check('El paciente no puede compartirse un borrador', (await as(p1, `update patient_documents set is_shared = true where title = 'Borrador' returning id`)).rows?.length !== 1);
  await db.exec(`reset role; set request.jwt.sub = ''; update consents set withdrawn_at = now() where patient_id = '${p1}' and withdrawn_at is null`);
  check('Sin consentimiento no ve ni abre documentos', (await as(p1, 'select (select count(*) from patient_documents) + (select count(*) from storage.objects) n')).rows[0].n == 0);
  await db.exec(`reset role; insert into consents (patient_id, version) values ('${p1}', 'prueba')`);
}

// 0017: resumen mensual
{
  check('El coach guarda un resumen', !(await as(coach, `insert into monthly_reviews (patient_id, month, conclusions, snapshot) values ('${p1}', date_trunc('month', current_date)::date, 'Buen mes', '{"a":1}')`)).error);
  check('El mes debe ser día 1', !!(await as(coach, `insert into monthly_reviews (patient_id, month) values ('${p1}', '2026-10-15')`)).error);
  check('Un solo resumen por paciente y mes', !!(await as(coach, `insert into monthly_reviews (patient_id, month) values ('${p1}', date_trunc('month', current_date)::date)`)).error);
  check('Sin compartir, el paciente no lo ve', (await as(p1, 'select count(*)::int n from monthly_reviews')).rows[0].n === 0);
  await as(coach, `update monthly_reviews set shared_at = now() where patient_id = '${p1}'`);
  check('Compartido, el paciente lo ve', (await as(p1, 'select count(*)::int n from monthly_reviews')).rows[0].n === 1);
  check('Otro paciente no lo ve', (await as(p2, 'select count(*)::int n from monthly_reviews')).rows[0].n === 0);
  check('El paciente no puede cambiar las conclusiones', (await as(p1, `update monthly_reviews set conclusions = 'x' returning id`)).rows?.length !== 1);
  check('El paciente no puede crear resúmenes', !!(await as(p1, `insert into monthly_reviews (patient_id, month) values ('${p1}', '2026-01-01')`)).error);
}

// 0018: historia clínica
{
  check('Sin doble factor, el coach no ve la historia', (await as(coach, 'select count(*)::int n from consultations')).rows[0].n === 0);
  check('Sin doble factor, el coach no escribe en la historia', !!(await as(coach, `insert into clinical_records (patient_id, main_reason) values ('${p1}', 'x')`)).error);
  check('Con doble factor, crea la ficha clínica', !(await mfa(coach, `insert into clinical_records (patient_id, main_reason, allergies) values ('${p1}', 'Distensión abdominal', 'Ninguna conocida')`)).error);
  check('Al editar la ficha se guarda la versión anterior', !(await mfa(coach, `update clinical_records set allergies = 'Penicilina' where patient_id = '${p1}'`)).error
    && (await mfa(coach, `select old_row->>'allergies' a from clinical_record_versions where patient_id = '${p1}'`)).rows[0]?.a === 'Ninguna conocida');
  check('La ficha no se puede borrar', !!(await mfa(coach, `delete from clinical_records where patient_id = '${p1}'`)).error);
  check('El paciente no ve su historia en la app', (await as(p1, 'select (select count(*) from clinical_records) + (select count(*) from consultations) n')).rows[0].n == 0);
  check('Ni con un token que diga doble factor', (await mfa(p1, 'select count(*)::int n from clinical_records')).rows[0].n === 0);

  const c1 = (await mfa(coach, `insert into consultations (patient_id, modality, reason, plan) values ('${p1}', 'online', 'Revisión', 'Luz por la mañana') returning id`)).rows[0].id;
  check('Se puede editar una consulta en borrador', !(await mfa(coach, `update consultations set findings = 'Mejor' where id = '${c1}'`)).error);
  check('Se cierra la consulta', !(await mfa(coach, `update consultations set status = 'closed' where id = '${c1}'`)).error);
  check('Cerrada, no se puede editar', !!(await mfa(coach, `update consultations set plan = 'otro' where id = '${c1}'`)).error);
  check('Cerrada, no se puede borrar', !!(await mfa(coach, `delete from consultations where id = '${c1}'`)).error);
  check('Se añade una adenda', !(await mfa(coach, `insert into consultation_addenda (consultation_id, patient_id, text) values ('${c1}', '${p1}', 'Corrijo: online')`)).error);
  check('La adenda no se puede cambiar', (await mfa(coach, `update consultation_addenda set text = 'x' returning id`)).rows?.length !== 1);
  check('La adenda debe ser del mismo paciente', !!(await mfa(coach, `insert into consultation_addenda (consultation_id, patient_id, text) values ('${c1}', '${p2}', 'x')`)).error);
  const c2 = (await mfa(coach, `insert into consultations (patient_id) values ('${p1}') returning id`)).rows[0].id;
  check('Un borrador se puede borrar', !(await mfa(coach, `delete from consultations where id = '${c2}'`)).error);

  check('Se registra un documento clínico', !(await mfa(coach, `insert into clinical_documents (patient_id, category, title, storage_path, mime) values ('${p1}', 'analitica', 'Analítica oct', '${p1}/a.pdf', 'application/pdf')`)).error);
  check('Documento clínico: la ruta debe ser del paciente', !!(await mfa(coach, `insert into clinical_documents (patient_id, title, storage_path, mime) values ('${p1}', 'x', '${p2}/a.pdf', 'application/pdf')`)).error);
  await db.exec(`reset role; set request.jwt.sub = ''; update clinical_documents set created_at = now() - interval '2 days' where title = 'Analítica oct'`);
  check('Pasadas 24 h, el documento no se borra', !!(await mfa(coach, `delete from clinical_documents where title = 'Analítica oct'`)).error);
  check('El coach con doble factor sube al almacén de la historia', !(await mfa(coach, `insert into storage.objects (bucket_id, name) values ('historia', '${p1}/a.pdf')`)).error);
  check('Sin doble factor no abre archivos de la historia', (await as(coach, `select count(*)::int n from storage.objects where bucket_id = 'historia'`)).rows[0].n === 0);
  check('El paciente no abre archivos de la historia', (await mfa(p1, `select count(*)::int n from storage.objects where bucket_id = 'historia'`)).rows[0].n === 0);
  check('Un archivo con documento no se puede borrar', (await mfa(coach, `delete from storage.objects where name = '${p1}/a.pdf' returning id`)).rows?.length !== 1);

  check('Se registra quién abre la historia', !(await mfa(coach, `select registrar_acceso('${p1}', 'ver_historia', 'ficha')`)).error);
  check('Sin doble factor no se registra ni se lee el registro', !!(await as(coach, `select registrar_acceso('${p1}', 'ver_historia', 'ficha')`)).error && (await as(coach, 'select count(*)::int n from access_log')).rows[0].n === 0);
  const nLog = (await mfa(coach, `select count(*)::int n from access_log where patient_id = '${p1}'`)).rows[0].n;
  check('Los cambios quedan en el registro de accesos', nLog >= 9);
  check('El registro no se puede borrar ni cambiar', !!(await mfa(coach, 'delete from access_log')).error && !!(await mfa(coach, `update access_log set action = 'crear'`)).error);
  check('Nadie escribe en el registro directamente', !!(await mfa(coach, `insert into access_log (action, entity) values ('crear', 'x')`)).error);
  check('Un paciente con historia no se puede eliminar', !!(await db.query(`delete from profiles where id = '${p1}'`).then(() => null, (e) => e)));
}

// 0019: avisos
{
  check('El paciente activa sus avisos', !(await as(p1, `insert into patient_settings (patient_id, reminder_enabled, reminder_time) values ('${p1}', true, '18:30') on conflict (patient_id) do update set reminder_enabled = true, reminder_time = '18:30'`)).error);
  check('El paciente guarda su dispositivo', !(await as(p1, `select guardar_suscripcion('https://push.example/abc', 'clave', 'auth', 'iPhone')`)).error);
  check('El mismo dispositivo con otra cuenta pasa a esa cuenta', !(await as(p2, `select guardar_suscripcion('https://push.example/abc', 'clave2', 'auth2')`)).error
    && (await db.query(`select user_id from push_subscriptions where endpoint = 'https://push.example/abc'`)).rows.map(r => r.user_id).join() === p2);
  check('Un paciente no ve los dispositivos de otro', (await as(p1, 'select count(*)::int n from push_subscriptions')).rows[0].n === 0);
  check('Suscripción con dirección rara se rechaza', !!(await as(p1, `select guardar_suscripcion('javascript:x', 'a', 'b')`)).error);
  check('Sin sesión no se guarda', !!(await as('', `select guardar_suscripcion('https://push.example/zz', 'a', 'b')`, 'anon')).error);
  check('El coach guarda la clave pública', !(await as(coach, `insert into app_settings (key, value) values ('vapid_public_key', 'BPubl1ca')`)).error);
  check('El paciente la lee', (await as(p1, `select value from app_settings`)).rows[0]?.value === 'BPubl1ca');
  check('El paciente no la cambia', (await as(p1, `update app_settings set value = 'x' returning key`)).rows?.length !== 1);
  check('No se guardan claves secretas en app_settings', !!(await as(coach, `insert into app_settings (key, value) values ('vapid_private_key', 'x')`)).error);
  check('Nadie escribe el registro de avisos desde la app', !!(await as(coach, `insert into notification_log (kind, user_id, ref) values ('mensaje', '${p1}', 'x')`)).error);
  check('Un paciente no puede guardar el secreto de avisos', !!(await as(p1, `select guardar_secreto_avisos('${'x'.repeat(40)}')`)).error);
}

// 0020: cuestionarios
{
  const rmeq = (await db.query(`select id from questionnaires where slug = 'rmeq'`)).rows[0].id;
  const chk = (await db.query(`select id from questionnaires where slug = 'checkin-semanal'`)).rows[0].id;
  check('El paciente no puede asignarse cuestionarios', !!(await as(p1, `insert into questionnaire_assignments (questionnaire_id, patient_id) values ('${rmeq}', '${p1}')`)).error);
  const a1 = (await as(coach, `insert into questionnaire_assignments (questionnaire_id, patient_id) values ('${rmeq}', '${p1}') returning id`)).rows[0].id;
  const a2 = (await as(coach, `insert into questionnaire_assignments (questionnaire_id, patient_id, recurrence) values ('${chk}', '${p1}', 'weekly') returning id`)).rows[0].id;
  check('Sin el módulo no ve sus cuestionarios', (await as(p1, 'select count(*)::int n from questionnaire_assignments')).rows[0].n === 0);
  await db.exec(`reset role; set request.jwt.sub = ''; insert into patient_modules (patient_id, module_slug) values ('${p1}', 'questionnaires')`);
  check('Con el módulo ve sus cuestionarios y sus preguntas', (await as(p1, 'select count(*)::int n from questionnaire_assignments')).rows[0].n === 2 && (await as(p1, 'select count(*)::int n from questionnaires')).rows[0].n === 2);
  check('Otro paciente no ve las preguntas', (await as(p2, 'select count(*)::int n from questionnaires')).rows[0].n === 0);
  check('Faltan respuestas: se rechaza', !!(await as(p1, `insert into questionnaire_responses (assignment_id, questionnaire_id, questionnaire_version, patient_id, period, answers) values ('${a1}', '${rmeq}', 1, '${p1}', 'x', '{"q1": 5}')`)).error);
  check('Opción inexistente: se rechaza', !!(await as(p1, `insert into questionnaire_responses (assignment_id, questionnaire_id, questionnaire_version, patient_id, period, answers) values ('${a1}', '${rmeq}', 1, '${p1}', 'x', '{"q1": 9, "q2": 4, "q3": 5, "q4": 5, "q5": 6}')`)).error);
  check('Responde el rMEQ', !(await as(p1, `insert into questionnaire_responses (assignment_id, questionnaire_id, questionnaire_version, patient_id, period, answers, score) values ('${a1}', '${rmeq}', 1, '${p1}', 'x', '{"q1": 5, "q2": 4, "q3": 4, "q4": 5, "q5": 4}', 99)`)).error);
  check('La puntuación la calcula la base de datos', (await as(coach, `select score from questionnaire_responses where assignment_id = '${a1}'`)).rows[0].score == 22);
  check('Y guarda el cronotipo', (await as(coach, `select chronotype from patient_settings where patient_id = '${p1}'`)).rows[0].chronotype === 'definitely_morning');
  check('No se responde dos veces el mismo cuestionario único', !!(await as(p1, `insert into questionnaire_responses (assignment_id, questionnaire_id, questionnaire_version, patient_id, period, answers) values ('${a1}', '${rmeq}', 1, '${p1}', 'x', '{"q1": 1, "q2": 1, "q3": 1, "q4": 1, "q5": 0}')`)).error);
  check('No puede cambiar lo enviado', (await as(p1, `update questionnaire_responses set score = 1 returning id`)).rows?.length !== 1);
  check('Check-in semanal con escala fuera de rango: se rechaza', !!(await as(p1, `insert into questionnaire_responses (assignment_id, questionnaire_id, questionnaire_version, patient_id, period, answers) values ('${a2}', '${chk}', 1, '${p1}', 'x', '{"sueno": 7, "energia": 3, "digestion": 3, "estres": 2, "dolor": 1}')`)).error);
  check('Responde el check-in de esta semana', !(await as(p1, `insert into questionnaire_responses (assignment_id, questionnaire_id, questionnaire_version, patient_id, period, answers) values ('${a2}', '${chk}', 1, '${p1}', 'x', '{"sueno": 4, "energia": 3, "digestion": 3, "estres": 2, "dolor": 1, "nota": "Bien"}')`)).error);
  check('Solo un check-in por semana', !!(await as(p1, `insert into questionnaire_responses (assignment_id, questionnaire_id, questionnaire_version, patient_id, period, answers) values ('${a2}', '${chk}', 1, '${p1}', 'x', '{"sueno": 4, "energia": 3, "digestion": 3, "estres": 2, "dolor": 1}')`)).error);
  check('No responde en nombre de otro paciente', !!(await as(p2, `insert into questionnaire_responses (assignment_id, questionnaire_id, questionnaire_version, patient_id, period, answers) values ('${a2}', '${chk}', 1, '${p1}', 'x', '{"sueno": 4, "energia": 3, "digestion": 3, "estres": 2, "dolor": 1}')`)).error);
  check('Otro paciente no ve las respuestas', (await as(p2, 'select count(*)::int n from questionnaire_responses')).rows[0].n === 0);
}

// 0021: respiración guiada
check('Sin el módulo, no anota respiración', !!(await as(p1, `insert into breathing_sessions (patient_id, pattern, seconds) values ('${p1}', 'lenta', 300)`)).error);
await db.exec(`reset role; set request.jwt.sub = ''; insert into patient_modules (patient_id, module_slug) values ('${p1}', 'breathing')`);
check('Con el módulo, anota una sesión', !(await as(p1, `insert into breathing_sessions (patient_id, pattern, seconds, calm_before, calm_after) values ('${p1}', 'lenta', 300, 2, 4)`)).error);
check('Pauta desconocida: se rechaza', !!(await as(p1, `insert into breathing_sessions (patient_id, pattern, seconds) values ('${p1}', 'otra', 300)`)).error);
check('Sesión de hace un mes: se rechaza', !!(await as(p1, `insert into breathing_sessions (patient_id, pattern, seconds, started_at) values ('${p1}', 'lenta', 300, now() - interval '30 days')`)).error);
check('No cambia lo anotado', (await as(p1, `update breathing_sessions set seconds = 3000 returning id`)).rows?.length !== 1);
check('No anota en nombre de otro', !!(await as(p2, `insert into breathing_sessions (patient_id, pattern, seconds) values ('${p1}', 'lenta', 300)`)).error);
check('Otro paciente no ve sus sesiones', (await as(p2, 'select count(*)::int n from breathing_sessions')).rows[0].n === 0);
check('El coach las ve', (await as(coach, `select count(*)::int n from breathing_sessions where patient_id = '${p1}'`)).rows[0].n === 1);

// 0022 y 0023: borrado de los datos bloqueados a los cinco años, solo con autorización del coach
{
  const [p5, p6, p7, p8] = ['55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888'];
  await db.exec(`reset role; set request.jwt.sub = '';
    insert into auth.users values ('${p5}','p5@x'),('${p6}','p6@x'),('${p7}','p7@x'),('${p8}','p8@x');
    insert into profiles (id, role, full_name, email) values ('${p5}','patient','P5','p5@x'),('${p6}','patient','P6','p6@x'),('${p7}','patient','P7','p7@x'),('${p8}','patient','P8','p8@x');
    insert into consents (patient_id, version, accepted_at, replaced_at) values ('${p5}','1.3', now() - interval '8 years', now() - interval '7 years');
    insert into consents (patient_id, version, accepted_at, withdrawn_at) values
      ('${p5}','1.4', now() - interval '7 years', now() - interval '6 years'),
      ('${p6}','1.4', now() - interval '7 years', now() - interval '6 years'),
      ('${p7}','1.4', now() - interval '2 years', now() - interval '1 year'),
      ('${p8}','1.4', now() - interval '7 years', null);
    insert into body_measurements (patient_id, measured_on, weight_kg) values ('${p5}', current_date - 2500, 70), ('${p6}', current_date - 2500, 80), ('${p7}', current_date - 500, 60);
    insert into coach_notes (patient_id, body) values ('${p5}', 'nota'), ('${p7}', 'nota');
    insert into clinical_records (patient_id, main_reason) values ('${p6}', 'Motivo');`);
  check('El paciente no puede cambiar su fecha de baja', !(await as(p7, `update profiles set archived_at = now() - interval '10 years' where id = '${p7}'`)).error
    && (await db.query(`select archived_at from profiles where id = '${p7}'`)).rows[0].archived_at === null);
  await as(coach, `update profiles set status = 'archived' where id = '${p8}'`);
  check('Al archivar se apunta la fecha de baja', (await db.query(`select archived_at is not null a from profiles where id = '${p8}'`)).rows[0].a === true);
  await db.exec(`reset role; set request.jwt.sub = ''; alter table profiles disable trigger profiles_archived_at; update profiles set archived_at = now() - interval '6 years' where id = '${p8}'; alter table profiles enable trigger profiles_archived_at;`);
  check('Ya no existe el borrado automático', (await db.query(`select count(*)::int n from pg_proc where proname = 'purgar_datos_bloqueados'`)).rows[0].n === 0);
  check('Sin doble factor, el coach no ve la lista de pendientes', (await as(coach, 'select count(*)::int n from pendientes_de_borrar()')).rows?.[0]?.n === 0);
  check('La lista interna no se puede leer desde la app', !!(await mfa(coach, 'select * from _pendientes_de_borrar()')).error);
  check('El aviso mensual de borrados se puede anotar', !(await db.query(`insert into notification_log (kind, user_id, ref, channel) values ('borrado_pendiente', '${coach}', '2031-01', 'email')`).catch(e => ({ error: e.message }))).error);
  check('Un paciente no ve la lista de pendientes', (await as(p1, 'select count(*)::int n from pendientes_de_borrar()')).rows?.[0]?.n === 0);
  const pend = (await mfa(coach, 'select patient_id from pendientes_de_borrar()')).rows.map(r => r.patient_id).sort().join();
  check('Con doble factor, el coach ve los tres bloqueados hace más de cinco años', pend === [p5, p6, p8].sort().join());
  check('Mirar la lista no borra nada', (await db.query(`select count(*)::int n from body_measurements where patient_id in ('${p5}', '${p6}')`)).rows[0].n === 2);
  check('Sin doble factor no se puede borrar', !!(await as(coach, `select borrar_datos_bloqueados('${p5}')`)).error);
  check('Un paciente no puede borrar', !!(await as(p1, `select borrar_datos_bloqueados('${p5}')`)).error);
  check('No se puede borrar a quien no lleva cinco años bloqueado', !!(await mfa(coach, `select borrar_datos_bloqueados('${p7}')`)).error
    && (await db.query(`select count(*)::int n from body_measurements where patient_id = '${p7}'`)).rows[0].n === 1);
  check('No se puede borrar a un paciente activo', !!(await mfa(coach, `select borrar_datos_bloqueados('${p1}')`)).error);
  check('No se puede borrar al coach', !!(await mfa(coach, `select borrar_datos_bloqueados('${coach}')`)).error
    && (await db.query(`select count(*)::int n from profiles where id = '${coach}'`)).rows[0].n === 1);
  check('El coach autoriza el borrado de un paciente sin historia: se borra la cuenta', !(await mfa(coach, `select borrar_datos_bloqueados('${p5}')`)).error
    && (await db.query(`select count(*)::int n from auth.users where id = '${p5}'`)).rows[0].n === 0);
  check('Los demás pendientes siguen intactos', (await db.query(`select count(*)::int n from body_measurements where patient_id = '${p6}'`)).rows[0].n === 1
    && (await db.query(`select count(*)::int n from auth.users where id = '${p8}'`)).rows[0].n === 1);
  check('Con historia clínica: se borran los datos de la app y se queda la historia', !(await mfa(coach, `select borrar_datos_bloqueados('${p6}')`)).error
    && (await db.query(`select count(*)::int n from body_measurements where patient_id = '${p6}'`)).rows[0].n === 0
    && (await db.query(`select count(*)::int n from clinical_records where patient_id = '${p6}'`)).rows[0].n === 1);
  check('Ya borrado, no vuelve a salir en la lista', !(await mfa(coach, 'select patient_id from pendientes_de_borrar()')).rows.some(r => r.patient_id === p6));
  check('Queda registro de quién lo autorizó', (await db.query(`select count(*)::int n from purge_log where autorizado_por = '${coach}'`)).rows[0].n === 2);
  check('El coach ve el registro de borrados', (await as(coach, 'select count(*)::int n from purge_log')).rows[0].n === 2);
  check('Un paciente no ve el registro de borrados', (await as(p1, 'select count(*)::int n from purge_log')).rows[0].n === 0);
  check('Nadie escribe el registro de borrados a mano', !!(await as(coach, `insert into purge_log (patient_id, motivo, cuenta_borrada, filas) values ('${p1}', 'baja', false, '{}')`)).error);
}

// 0024: suscripciones de WooCommerce → propuesta de módulos que aplica el coach
{
  const ps = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  await db.exec(`reset role; set request.jwt.sub = ''; insert into auth.users values ('${ps}','sus@x'); insert into profiles (id, role, full_name, email) values ('${ps}','patient','Sus','sus@x'); insert into consents (patient_id, version) values ('${ps}','1.4'); insert into patient_modules (patient_id, module_slug) values ('${ps}','training');`);
  const aviso = (id, email, status, product = 13847) => JSON.stringify({ id, status, billing: { email }, line_items: [{ product_id: product, variation_id: 14001 }], next_payment_date_gmt: '2026-12-09 10:00:00' });
  check('Nadie registra suscripciones desde la app', !!(await as(coach, `select registrar_suscripcion('${aviso(1, 'p1@x', 'active')}'::jsonb)`)).error);
  await db.query(`select registrar_suscripcion('${aviso(9001, 'SUS@x', 'active')}'::jsonb)`);
  await db.query(`select registrar_suscripcion('${aviso(9002, 'nuevo@x', 'active')}'::jsonb)`);
  check('La suscripción se enlaza con el paciente del mismo email', (await db.query(`select patient_id from memberships where woo_subscription_id = 9001`)).rows[0].patient_id === ps);
  const antes = (await db.query(`select count(*)::int n from patient_modules where patient_id = '${ps}'`)).rows[0].n;
  check('Registrar el pago no cambia los módulos', (await db.query(`select count(*)::int n from patient_modules where patient_id = '${ps}'`)).rows[0].n === antes);
  const prop = (await as(coach, 'select * from cambios_suscripcion()')).rows;
  const de1 = prop.find(r => r.patient_id === ps);
  check('El coach ve la propuesta de abrir los módulos del plan', !!de1 && de1.activar.includes('circadian') && de1.activar.includes('habits'));
  check('Y quién ha pagado sin tener cuenta', prop.some(r => r.sin_cuenta && r.email === 'nuevo@x'));
  check('Un paciente no ve las propuestas', (await as(p1, 'select count(*)::int n from cambios_suscripcion()')).rows[0].n === 0);
  check('Un paciente no puede aplicar cambios', !!(await as(p1, `select aplicar_cambio_suscripcion('${ps}')`)).error);
  check('El coach aplica: se abren los módulos', !(await as(coach, `select aplicar_cambio_suscripcion('${ps}')`)).error
    && (await db.query(`select count(*)::int n from patient_modules where patient_id = '${ps}' and module_slug in ('circadian', 'habits', 'questionnaires')`)).rows[0].n === 3);
  await db.query(`insert into sleep_logs (patient_id, night_of, bedtime, wake_time, quality) values ('${ps}', current_date - 1, (current_date - 1) + time '23:00', current_date + time '07:00', 4)`).catch(() => {});
  const suenos = (await db.query(`select count(*)::int n from sleep_logs where patient_id = '${ps}'`)).rows[0].n;
  await db.query(`select registrar_suscripcion('${aviso(9001, 'sus@x', 'cancelled')}'::jsonb)`);
  check('Cancelar en WooCommerce no cierra nada solo', (await db.query(`select count(*)::int n from patient_modules where patient_id = '${ps}' and module_slug = 'circadian'`)).rows[0].n === 1);
  const prop2 = (await as(coach, 'select * from cambios_suscripcion()')).rows.find(r => r.patient_id === ps);
  check('Propone cerrar los módulos del plan cancelado', !!prop2 && prop2.desactivar.includes('circadian') && !prop2.desactivar.includes('training'));
  check('El coach aplica: se cierran, sin tocar entrenamiento', !(await as(coach, `select aplicar_cambio_suscripcion('${ps}')`)).error
    && (await db.query(`select count(*)::int n from patient_modules where patient_id = '${ps}' and module_slug = 'circadian'`)).rows[0].n === 0
    && (await db.query(`select count(*)::int n from patient_modules where patient_id = '${ps}' and module_slug = 'training'`)).rows[0].n === 1);
  check('Cerrar un módulo no borra sus datos', (await db.query(`select count(*)::int n from sleep_logs where patient_id = '${ps}'`)).rows[0].n === suenos);
  check('Sin cambios pendientes no hay nada que aplicar', !!(await as(coach, `select aplicar_cambio_suscripcion('${ps}')`)).error);
  check('Un plan con un módulo inventado se rechaza', !!(await as(coach, `insert into plan_products (woo_product_id, plan, modules) values (1, 'X', array['inventado'])`)).error);
  check('Un paciente no ve ni cambia los planes', (await as(p1, 'select count(*)::int n from plan_products')).rows[0].n === 0);
  await db.exec(`reset role; set request.jwt.sub = ''; insert into auth.users values ('99999999-9999-9999-9999-999999999999','nuevo@x'); insert into profiles (id, role, full_name, email) values ('99999999-9999-9999-9999-999999999999','patient','Nuevo','nuevo@x');`);
  check('Al darle de alta, su suscripción se enlaza (sin abrir nada)', (await db.query(`select patient_id from memberships where woo_subscription_id = 9002`)).rows[0].patient_id === '99999999-9999-9999-9999-999999999999'
    && (await db.query(`select count(*)::int n from patient_modules where patient_id = '99999999-9999-9999-9999-999999999999'`)).rows[0].n === 0);
}

// 0025: módulo «sol»
{
  check('El módulo sol existe y está disponible', (await db.query(`select is_available from modules where slug = 'sun'`)).rows[0]?.is_available === true);
  check('Un paciente no puede activarse el módulo sol', !!(await as(p2, `insert into patient_modules (patient_id, module_slug) values ('${p2}', 'sun')`)).error);
  check('El coach se lo activa', !(await as(coach, `insert into patient_modules (patient_id, module_slug) values ('${p2}', 'sun') on conflict do nothing`)).error);
  check('Con el módulo, elige su ciudad', !(await as(p2, `insert into patient_settings (patient_id, city, latitude, longitude) values ('${p2}', 'Valencia', 39.47, -0.38) on conflict (patient_id) do update set city = 'Valencia', latitude = 39.47, longitude = -0.38`)).error);
  check('Otro paciente no ve su ciudad', (await as(p1, `select count(*)::int n from patient_settings where patient_id = '${p2}'`)).rows[0].n === 0);
}

// 0026: ajustes de la revisión de seguridad
{
  const it = (await db.query(`select i.id from workout_items i join workout_blocks b on b.id = i.block_id join workouts w on w.id = b.workout_id where w.patient_id = '${p2}' and w.status = 'scheduled' limit 1`)).rows[0]?.id;
  const w2 = (await db.query(`select w.id from workouts w where w.patient_id = '${p2}' and w.status = 'scheduled' limit 1`)).rows[0]?.id;
  await db.exec(`reset role; set request.jwt.sub = ''; delete from patient_modules where patient_id = '${p2}' and module_slug = 'training'`);
  check('Sin el módulo de entrenamiento no registra series', !!(await as(p2, `insert into set_logs (workout_item_id, patient_id, set_number, reps, done) values ('${it}', '${p2}', 1, 10, true)`)).error);
  check('Sin el módulo no deja notas por ejercicio', !!(await as(p2, `insert into workout_item_feedback (workout_item_id, patient_id, note) values ('${it}', '${p2}', 'x')`)).error);
  check('Sin el módulo no puede terminar sesiones', (await as(p2, `update workouts set status = 'completed' where id = '${w2}' returning id`)).rows?.length !== 1);
  check('Sin el módulo sigue viendo su historial', (await as(p2, 'select count(*)::int n from workouts')).rows[0].n > 0);
  await db.exec(`reset role; set request.jwt.sub = ''; insert into patient_modules (patient_id, module_slug) values ('${p2}', 'training')`);
  check('Con el módulo registra series', !(await as(p2, `insert into set_logs (workout_item_id, patient_id, set_number, reps, done) values ('${it}', '${p2}', 1, 10, true)`)).error);
  check('No puede poner fecha de fin en el futuro', (await as(p2, `update workouts set completed_at = now() + interval '3 days' where id = '${w2}' returning id`)).rows?.length !== 1);
  check('Sensaciones demasiado largas: se rechaza', !!(await as(p2, `update workouts set feeling = repeat('a', 600) where id = '${w2}'`)).error);
  check('Notas de sesión normales: se aceptan', !(await as(p2, `update workouts set patient_notes = 'Bien, algo cansado' where id = '${w2}'`)).error);
}

// El diseño de fase 2 (no aplicado en Supabase) debe seguir siendo válido sobre las migraciones
await db.exec(fs.readFileSync(new URL('../diseno/fase2_habitos_circadiano_cuestionarios.sql', import.meta.url), 'utf8'));
await db.exec('grant select, insert, update, delete on all tables in schema public to authenticated');
console.log('Diseño de fase 2 aplicado (solo en la prueba)');


console.log(fails ? `\n${fails} prueba(s) fallidas` : '\nTodas las pruebas superadas');
process.exit(fails ? 1 : 0);
