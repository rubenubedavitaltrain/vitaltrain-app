-- Módulo «sol» (plan gratuito Ritmo): panel solar de la ciudad y ventana de vitamina D.
-- Es lo básico del pilar Contacto con la naturaleza, separado del circadiano completo.
-- No guarda datos nuevos: solo usa la ciudad elegida (patient_settings), que ya existe.
-- Activarlo a un paciente no cambia nada más. Depende de 0001-0024.

insert into modules (slug, name, description, is_available)
values ('sun', 'Sol y vitamina D', 'Amanecer, atardecer, ventanas de luz y vitamina D en su ciudad', true)
on conflict (slug) do update set is_available = true;
