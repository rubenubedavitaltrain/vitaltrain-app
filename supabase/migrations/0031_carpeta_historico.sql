-- Enlace a la carpeta del histórico de cada paciente (OneDrive) en su ficha clínica.
-- Paso A de la conexión con el histórico: no se mueve ningún archivo; desde la ficha se abre su carpeta de un clic.
-- Va en clinical_records: solo lo ve el coach con doble factor, y cada cambio queda en las versiones de la ficha.
-- Solo enlaces https. No borra ni cambia ningún dato existente. Independiente de 0030.

alter table clinical_records add column archive_url text
  check (archive_url is null or (archive_url ~ '^https://[^\s]+$' and char_length(archive_url) <= 1000));
