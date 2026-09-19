-- Solo nombres. Prisma deriva el nombre de una FK compuesta de sus columnas, y yo
-- las habia acortado a mano para no pasar del limite de 63 caracteres de Postgres.
-- Los nombres largos si caben, asi que se usan los que Prisma espera y el diff
-- queda limpio.

ALTER TABLE commercial.prospect_state_history
  RENAME CONSTRAINT prospect_state_history_from_light_code_fkey
                 TO prospect_state_history_from_state_id_status_light_code_fkey;
ALTER TABLE commercial.prospect_state_history
  RENAME CONSTRAINT prospect_state_history_to_light_code_fkey
                 TO prospect_state_history_to_state_id_status_light_code_fkey;

ALTER TABLE demand.requisition_state_history
  RENAME CONSTRAINT requisition_state_history_from_light_code_fkey
                 TO requisition_state_history_from_state_id_status_light_code_fkey;
ALTER TABLE demand.requisition_state_history
  RENAME CONSTRAINT requisition_state_history_to_light_code_fkey
                 TO requisition_state_history_to_state_id_status_light_code_fkey;
