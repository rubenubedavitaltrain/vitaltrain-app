-- Frase de cada pilar: se muestra al paciente bajo el nombre del pilar.
-- Elegidas por Rubén el 26 oct 2026. Máximo 90 caracteres.

update pillars set description = 'Qué comes importa. Cuándo y cómo lo comes, también.' where slug = 'alimentacion-consciente';
update pillars set description = 'No se trata de entrenar más, sino de entrenar con sentido.' where slug = 'movimiento-inteligente';
update pillars set description = 'Tu biología funciona por horarios. Respetarlos ordena todo lo demás.' where slug = 'ritmos-circadianos';
update pillars set description = 'Tu sistema nervioso necesita calma para poder reparar.' where slug = 'regulacion-emocional';
update pillars set description = 'Sol, tierra y aire libre: los estímulos con los que evolucionó tu cuerpo.' where slug = 'contacto-naturaleza';

alter table pillars add constraint pillars_description_length check (description is null or char_length(description) <= 90);
