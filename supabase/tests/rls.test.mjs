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
insert into exercises (name) values ('Sentadilla');
insert into templates (name) values ('Fuerza A');
insert into template_blocks (template_id, position) select id, 1 from templates;
insert into template_items (block_id, position, exercise_id, sets, rest_seconds) select b.id,1,e.id,3,90 from template_blocks b, exercises e where e.name = 'Sentadilla';
`);

const as = async (uid, sql, role = 'authenticated') => {
  await db.exec(`reset role; set request.jwt.sub = '${uid}'; set role ${role};`);
  try { return { rows: (await db.query(sql)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
};

let fails = 0;
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
await db.exec(`reset role; set request.jwt.sub = ''; insert into auth.users values ('${p3}','p3@x'); insert into profiles (id, role, full_name, email) values ('${p3}','patient','P3','p3@x');`);
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

// El diseño de fase 2 (no aplicado en Supabase) debe seguir siendo válido sobre las migraciones
await db.exec(fs.readFileSync(new URL('../diseno/fase2_habitos_circadiano_cuestionarios.sql', import.meta.url), 'utf8'));
await db.exec('grant select, insert, update, delete on all tables in schema public to authenticated');
console.log('Diseño de fase 2 aplicado (solo en la prueba)');


console.log(fails ? `\n${fails} prueba(s) fallidas` : '\nTodas las pruebas superadas');
process.exit(fails ? 1 : 0);
