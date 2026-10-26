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
insert into exercises (name) values ('Sentadilla');
insert into templates (name) values ('Fuerza A');
insert into template_blocks (template_id, position) select id, 1 from templates;
insert into template_items (block_id, position, exercise_id, sets, rest_seconds) select b.id,1,e.id,3,90 from template_blocks b, exercises e;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
`);

const as = async (uid, sql) => {
  await db.exec(`reset role; set request.jwt.sub = '${uid}'; set role authenticated;`);
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
check('Sin el módulo activo, no se puede registrar sueño', !!(await as(p1, `insert into sleep_logs (patient_id, night_of, quality) values ('${p1}', current_date, 4)`)).error);

console.log(fails ? `\n${fails} prueba(s) fallidas` : '\nTodas las pruebas superadas');
process.exit(fails ? 1 : 0);
