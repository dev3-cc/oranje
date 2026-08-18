-- El hotel guardaba DONDE esta en el mapa pero no COMO se llega. Las
-- coordenadas alimentan la geocerca del ponche y los pines de Mi Territorio;
-- ninguna de las dos se puede copiar en Waze ni leer en una ficha.
--
-- Va aqui y no en otra tabla porque es lo mas permanente que tiene un
-- edificio, que es justo el criterio con el que se definio commercial.hotel.
--
-- Nulables y sin backfill: los hoteles ya cargados no la tienen. Google Places
-- las entrega juntas, asi que en la practica llegan las dos o ninguna.
--
-- place_id no es redundante con address: es el identificador estable de Google.
-- Sobrevive a que alguien reescriba la calle a mano y permite volver a
-- consultar el lugar sin depender de como se escribio.

ALTER TABLE commercial.hotel
  ADD COLUMN address  text,
  ADD COLUMN place_id text;
