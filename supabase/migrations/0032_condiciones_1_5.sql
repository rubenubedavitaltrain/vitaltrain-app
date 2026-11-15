-- Condiciones del paciente, versión 1.5 (15 nov 2026).
-- Añade el asistente de IA que usa el profesional (Anthropic como encargado del tratamiento)
-- y aclara que la ubicación actual se usa solo en el móvil. Visto bueno de la asesora el 15 nov 2026.
--
-- Solo añade la versión: la 1.4 sigue valiendo, nadie se queda sin acceso.
-- La app pide aceptar la 1.5 al entrar. Retirar la 1.4 será otra migración, cuando Rubén lo decida.
-- No borra ni cambia ningún dato. Depende de 0029.

insert into consent_versions (version) values ('1.5') on conflict (version) do nothing;
