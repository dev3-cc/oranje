/**
 * El catálogo de Industrias, Departamentos de Hotel y Posiciones.
 *
 * Vive aparte de `seed.ts` para que `scripts/seed-catalog-industries.ts`
 * (el INSERT aditivo que se corre contra staging/producción sin volver a
 * correr el seed completo — ese resiembra role_permission y puede revocar
 * permisos de otras ramas) pueda importar los mismos datos sin disparar
 * el resto del seed, que corre entero al importarse (`main()` al final de
 * `seed.ts` no tiene guardia).
 */

export const HOTEL_DEPARTMENTS = [
  { code: 'HOUSEKEEPING', name: 'Housekeeping' },
  { code: 'FOOD', name: 'Alimentos' },
  { code: 'MAINTENANCE', name: 'Mantenimiento' },
  { code: 'FRONT_DESK', name: 'Front Desk' },
]

/// Las industrias que Oranje cotiza (Hugo, 2026-10-17): el catálogo deja de
/// ser solo hoteles. Hospitality es la única con departamento de hotel
/// (abajo); el resto no tiene ese concepto.
export const INDUSTRIES = [
  { code: 'HOSPITALITY', name: 'Hospitality' },
  { code: 'WAREHOUSE_LOGISTICS', name: 'Warehouse & Logistics' },
  { code: 'RETAIL', name: 'Retail' },
  { code: 'EVENTS', name: 'Events' },
  { code: 'COMMERCIAL_CLEANING', name: 'Commercial Cleaning & Facilities' },
  { code: 'LIGHT_INDUSTRIAL', name: 'Light Industrial & Manufacturing' },
  { code: 'FOOD_SERVICE_CATERING', name: 'Food Service & Catering' },
  { code: 'ADMIN_SUPPORT', name: 'Office & Administrative Support' },
  { code: 'IT_TECHNOLOGY', name: 'IT & Technology' },
]

/// Agrupadas por industria y, dentro de Hospitality, por departamento de
/// hotel (`department: null` en el resto — esas industrias no tienen
/// departamento de hotel). Lista de posiciones traída por Hugo el
/// 2026-10-17; no es exhaustiva, el negocio agrega el resto desde la app.
export const POSITIONS: Array<{
  code: string
  name: string
  industry: string
  department: string | null
}> = [
  // --- Hospitality · Housekeeping ---
  { code: 'HOUSEKEEPER', name: 'Housekeeper', industry: 'HOSPITALITY', department: 'HOUSEKEEPING' },
  { code: 'HOUSEMAN', name: 'Houseman', industry: 'HOSPITALITY', department: 'HOUSEKEEPING' },
  {
    code: 'LAUNDRY',
    name: 'Laundry Attendants',
    industry: 'HOSPITALITY',
    department: 'HOUSEKEEPING',
  },
  {
    code: 'HOSP_LOBBY_ATTENDANT',
    name: 'Lobby Attendants',
    industry: 'HOSPITALITY',
    department: 'HOUSEKEEPING',
  },
  {
    code: 'HOSP_PUBLIC_AREA_ATTENDANT',
    name: 'Public Area Attendants',
    industry: 'HOSPITALITY',
    department: 'HOUSEKEEPING',
  },
  {
    code: 'HOSP_HOUSEKEEPING_SUPERVISOR',
    name: 'Housekeeping Supervisors',
    industry: 'HOSPITALITY',
    department: 'HOUSEKEEPING',
  },
  {
    code: 'HOSP_EXECUTIVE_HOUSEKEEPER',
    name: 'Executive Housekeeper',
    industry: 'HOSPITALITY',
    department: 'HOUSEKEEPING',
  },
  // --- Hospitality · Mantenimiento ---
  {
    code: 'HOSP_MAINTENANCE',
    name: 'Maintenance',
    industry: 'HOSPITALITY',
    department: 'MAINTENANCE',
  },
  // --- Hospitality · Alimentos (F&B) ---
  { code: 'CHEF', name: 'Chef', industry: 'HOSPITALITY', department: 'FOOD' },
  {
    code: 'HOSP_BREAKFAST_SERVER',
    name: 'Breakfast Server',
    industry: 'HOSPITALITY',
    department: 'FOOD',
  },
  {
    code: 'HOSP_DISHWASHER_STEWARD',
    name: 'Dishwasher / Steward',
    industry: 'HOSPITALITY',
    department: 'FOOD',
  },
  { code: 'HOSP_PREP_COOK', name: 'Prep Cook', industry: 'HOSPITALITY', department: 'FOOD' },
  { code: 'HOSP_LINE_COOK', name: 'Line Cook', industry: 'HOSPITALITY', department: 'FOOD' },
  { code: 'HOSP_COOK', name: 'Cook', industry: 'HOSPITALITY', department: 'FOOD' },
  {
    code: 'HOSP_BANQUET_SERVER_SETUP',
    name: 'Banquet Server & Setup',
    industry: 'HOSPITALITY',
    department: 'FOOD',
  },
  {
    code: 'HOSP_SERVER_COCKTAIL',
    name: 'Server / Cocktail Server',
    industry: 'HOSPITALITY',
    department: 'FOOD',
  },
  {
    code: 'HOSP_HOST_GREETER',
    name: 'Host / Greeter',
    industry: 'HOSPITALITY',
    department: 'FOOD',
  },
  {
    code: 'HOSP_BANQUET_CAPTAIN',
    name: 'Banquet Captain',
    industry: 'HOSPITALITY',
    department: 'FOOD',
  },
  { code: 'HOSP_BARTENDER', name: 'Bartender', industry: 'HOSPITALITY', department: 'FOOD' },
  { code: 'HOSP_BARBACK', name: 'Barback', industry: 'HOSPITALITY', department: 'FOOD' },
  // --- Hospitality · Front Desk ---
  {
    code: 'HOSP_FRONT_DESK_AGENT',
    name: 'Front Desk Agent',
    industry: 'HOSPITALITY',
    department: 'FRONT_DESK',
  },
  {
    code: 'HOSP_NIGHT_AUDITOR',
    name: 'Night Auditor',
    industry: 'HOSPITALITY',
    department: 'FRONT_DESK',
  },
  {
    code: 'HOSP_FRONT_DESK_SUPERVISOR',
    name: 'Front Desk Supervisor',
    industry: 'HOSPITALITY',
    department: 'FRONT_DESK',
  },
  // --- Hospitality · Hotel Management (sin departamento: cruza todos) ---
  {
    code: 'HOSP_FRONT_DESK_MANAGER',
    name: 'Front Desk Manager',
    industry: 'HOSPITALITY',
    department: null,
  },
  { code: 'HOSP_SALES_MANAGER', name: 'Sales Manager', industry: 'HOSPITALITY', department: null },
  {
    code: 'HOSP_CHIEF_OF_ENGINEERING',
    name: 'Chief of Engineering',
    industry: 'HOSPITALITY',
    department: null,
  },

  // --- Warehouse & Logistics ---
  {
    code: 'WH_WAREHOUSE_ASSOCIATE',
    name: 'Warehouse Associate',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_PICKER_PACKER',
    name: 'Picker / Packer',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_ORDER_SELECTOR',
    name: 'Order Selector',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_SHIPPING_RECEIVING',
    name: 'Shipping & Receiving Associate',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_LOADER_UNLOADER',
    name: 'Loader / Unloader',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_INVENTORY_ASSOCIATE',
    name: 'Inventory Associate',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_MATERIAL_HANDLER',
    name: 'Material Handler',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_FORKLIFT_OPERATOR',
    name: 'Forklift Operator',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  { code: 'WH_PALLETIZER', name: 'Palletizer', industry: 'WAREHOUSE_LOGISTICS', department: null },
  {
    code: 'WH_RETURNS_PROCESSING',
    name: 'Returns Processing Associate',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_QUALITY_CONTROL',
    name: 'Quality Control Associate',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_WAREHOUSE_LEAD',
    name: 'Warehouse Lead',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },
  {
    code: 'WH_WAREHOUSE_SUPERVISOR',
    name: 'Warehouse Supervisor',
    industry: 'WAREHOUSE_LOGISTICS',
    department: null,
  },

  // --- Retail ---
  { code: 'RETAIL_ASSOCIATE', name: 'Retail Associate', industry: 'RETAIL', department: null },
  { code: 'RETAIL_CASHIER', name: 'Cashier', industry: 'RETAIL', department: null },
  { code: 'RETAIL_STOCK_ASSOCIATE', name: 'Stock Associate', industry: 'RETAIL', department: null },
  {
    code: 'RETAIL_MERCHANDISING_SUPPORT',
    name: 'Merchandising Support Associate',
    industry: 'RETAIL',
    department: null,
  },
  {
    code: 'RETAIL_INVENTORY_ASSOCIATE',
    name: 'Inventory Associate',
    industry: 'RETAIL',
    department: null,
  },
  {
    code: 'RETAIL_RECEIVING_ASSOCIATE',
    name: 'Receiving Associate',
    industry: 'RETAIL',
    department: null,
  },
  {
    code: 'RETAIL_CUSTOMER_SERVICE_REP',
    name: 'Customer Service Representative',
    industry: 'RETAIL',
    department: null,
  },
  {
    code: 'RETAIL_BRAND_AMBASSADOR',
    name: 'Brand Ambassador',
    industry: 'RETAIL',
    department: null,
  },
  {
    code: 'RETAIL_STORE_SUPPORT_STAFF',
    name: 'Store Support Staff',
    industry: 'RETAIL',
    department: null,
  },
  { code: 'RETAIL_TEAM_LEAD', name: 'Team Lead', industry: 'RETAIL', department: null },
  {
    code: 'RETAIL_ASSISTANT_MANAGER',
    name: 'Assistant Manager',
    industry: 'RETAIL',
    department: null,
  },
  { code: 'RETAIL_STORE_MANAGER', name: 'Store Manager', industry: 'RETAIL', department: null },

  // --- Events ---
  { code: 'EVT_EVENT_STAFF', name: 'Event Staff', industry: 'EVENTS', department: null },
  {
    code: 'EVT_REGISTRATION_STAFF',
    name: 'Registration Staff',
    industry: 'EVENTS',
    department: null,
  },
  { code: 'EVT_USHER', name: 'Usher', industry: 'EVENTS', department: null },
  { code: 'EVT_GREETER', name: 'Greeter', industry: 'EVENTS', department: null },
  { code: 'EVT_BRAND_AMBASSADOR', name: 'Brand Ambassador', industry: 'EVENTS', department: null },
  {
    code: 'EVT_GUEST_SERVICES',
    name: 'Guest Services Associate',
    industry: 'EVENTS',
    department: null,
  },
  {
    code: 'EVT_TICKETING_SUPPORT',
    name: 'Ticketing Support Staff',
    industry: 'EVENTS',
    department: null,
  },
  {
    code: 'EVT_SETUP_BREAKDOWN',
    name: 'Event Setup & Breakdown Crew',
    industry: 'EVENTS',
    department: null,
  },
  { code: 'EVT_BANQUET_SERVER', name: 'Banquet Server', industry: 'EVENTS', department: null },
  {
    code: 'EVT_BARTENDER_SUPPORT',
    name: 'Bartender Support',
    industry: 'EVENTS',
    department: null,
  },
  { code: 'EVT_RUNNER', name: 'Runner', industry: 'EVENTS', department: null },
  {
    code: 'EVT_PRODUCTION_ASSISTANT',
    name: 'Production Assistant',
    industry: 'EVENTS',
    department: null,
  },
  { code: 'EVT_EVENT_SUPERVISOR', name: 'Event Supervisor', industry: 'EVENTS', department: null },

  // --- Commercial Cleaning & Facilities ---
  {
    code: 'CLEAN_JANITORIAL_STAFF',
    name: 'Janitorial Staff',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },
  {
    code: 'CLEAN_DAY_PORTER',
    name: 'Day Porter',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },
  {
    code: 'CLEAN_NIGHT_CLEANER',
    name: 'Night Cleaner',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },
  {
    code: 'CLEAN_FLOOR_CARE_TECH',
    name: 'Floor Care Technician',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },
  {
    code: 'CLEAN_PUBLIC_AREA_ATTENDANT',
    name: 'Public Area Attendant',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },
  {
    code: 'CLEAN_RESTROOM_ATTENDANT',
    name: 'Restroom Attendant',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },
  {
    code: 'CLEAN_BUILDING_SUPPORT',
    name: 'Building Support Staff',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },
  {
    code: 'CLEAN_MAINTENANCE_ASSISTANT',
    name: 'Maintenance Assistant',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },
  {
    code: 'CLEAN_CLEANING_LEAD',
    name: 'Cleaning Lead',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },
  {
    code: 'CLEAN_SITE_SUPERVISOR',
    name: 'Site Supervisor',
    industry: 'COMMERCIAL_CLEANING',
    department: null,
  },

  // --- Light Industrial & Manufacturing ---
  {
    code: 'LI_PRODUCTION_ASSOCIATE',
    name: 'Production Associate',
    industry: 'LIGHT_INDUSTRIAL',
    department: null,
  },
  { code: 'LI_ASSEMBLER', name: 'Assembler', industry: 'LIGHT_INDUSTRIAL', department: null },
  {
    code: 'LI_PACKAGING_ASSOCIATE',
    name: 'Packaging Associate',
    industry: 'LIGHT_INDUSTRIAL',
    department: null,
  },
  {
    code: 'LI_MACHINE_HELPER',
    name: 'Machine Helper',
    industry: 'LIGHT_INDUSTRIAL',
    department: null,
  },
  {
    code: 'LI_MATERIAL_HANDLER',
    name: 'Material Handler',
    industry: 'LIGHT_INDUSTRIAL',
    department: null,
  },
  {
    code: 'LI_QUALITY_INSPECTOR',
    name: 'Quality Inspector',
    industry: 'LIGHT_INDUSTRIAL',
    department: null,
  },
  {
    code: 'LI_PRODUCTION_LINE_WORKER',
    name: 'Production Line Worker',
    industry: 'LIGHT_INDUSTRIAL',
    department: null,
  },
  {
    code: 'LI_SANITATION_STAFF',
    name: 'Sanitation Staff',
    industry: 'LIGHT_INDUSTRIAL',
    department: null,
  },
  {
    code: 'LI_INVENTORY_SUPPORT',
    name: 'Inventory Support Associate',
    industry: 'LIGHT_INDUSTRIAL',
    department: null,
  },
  { code: 'LI_TEAM_LEAD', name: 'Team Lead', industry: 'LIGHT_INDUSTRIAL', department: null },
  {
    code: 'LI_SHIFT_SUPERVISOR',
    name: 'Shift Supervisor',
    industry: 'LIGHT_INDUSTRIAL',
    department: null,
  },

  // --- Food Service & Catering ---
  { code: 'FSC_SERVER', name: 'Server', industry: 'FOOD_SERVICE_CATERING', department: null },
  {
    code: 'FSC_BANQUET_SERVER',
    name: 'Banquet Server',
    industry: 'FOOD_SERVICE_CATERING',
    department: null,
  },
  { code: 'FSC_PREP_COOK', name: 'Prep Cook', industry: 'FOOD_SERVICE_CATERING', department: null },
  { code: 'FSC_LINE_COOK', name: 'Line Cook', industry: 'FOOD_SERVICE_CATERING', department: null },
  { code: 'FSC_CHEF', name: 'Chef', industry: 'FOOD_SERVICE_CATERING', department: null },
  {
    code: 'FSC_DISHWASHER',
    name: 'Dishwasher',
    industry: 'FOOD_SERVICE_CATERING',
    department: null,
  },
  {
    code: 'FSC_FOOD_RUNNER',
    name: 'Food Runner',
    industry: 'FOOD_SERVICE_CATERING',
    department: null,
  },
  { code: 'FSC_BUSSER', name: 'Busser', industry: 'FOOD_SERVICE_CATERING', department: null },
  {
    code: 'FSC_CATERING_STAFF',
    name: 'Catering Staff',
    industry: 'FOOD_SERVICE_CATERING',
    department: null,
  },
  {
    code: 'FSC_KITCHEN_ASSISTANT',
    name: 'Kitchen Assistant',
    industry: 'FOOD_SERVICE_CATERING',
    department: null,
  },
  {
    code: 'FSC_SUPERVISOR',
    name: 'Supervisor',
    industry: 'FOOD_SERVICE_CATERING',
    department: null,
  },
  {
    code: 'FSC_FOOD_SERVICE_MANAGER',
    name: 'Food Service Manager',
    industry: 'FOOD_SERVICE_CATERING',
    department: null,
  },

  // --- Office & Administrative Support ---
  { code: 'ADMIN_RECEPTIONIST', name: 'Receptionist', industry: 'ADMIN_SUPPORT', department: null },
  {
    code: 'ADMIN_ADMINISTRATIVE_ASSISTANT',
    name: 'Administrative Assistant',
    industry: 'ADMIN_SUPPORT',
    department: null,
  },
  {
    code: 'ADMIN_DATA_ENTRY',
    name: 'Data Entry Clerk',
    industry: 'ADMIN_SUPPORT',
    department: null,
  },
  {
    code: 'ADMIN_CUSTOMER_SERVICE_REP',
    name: 'Customer Service Representative',
    industry: 'ADMIN_SUPPORT',
    department: null,
  },
  {
    code: 'ADMIN_OFFICE_COORDINATOR',
    name: 'Office Coordinator',
    industry: 'ADMIN_SUPPORT',
    department: null,
  },
  {
    code: 'ADMIN_SCHEDULING_ASSISTANT',
    name: 'Scheduling Assistant',
    industry: 'ADMIN_SUPPORT',
    department: null,
  },
  {
    code: 'ADMIN_DOCUMENT_PROCESSING',
    name: 'Document Processing Clerk',
    industry: 'ADMIN_SUPPORT',
    department: null,
  },
  {
    code: 'ADMIN_ACCOUNTING_SUPPORT',
    name: 'Accounting Support Clerk',
    industry: 'ADMIN_SUPPORT',
    department: null,
  },
  {
    code: 'ADMIN_EXECUTIVE_ASSISTANT',
    name: 'Executive Assistant',
    industry: 'ADMIN_SUPPORT',
    department: null,
  },
  {
    code: 'ADMIN_OFFICE_MANAGER',
    name: 'Office Manager',
    industry: 'ADMIN_SUPPORT',
    department: null,
  },

  // --- IT & Technology ---
  {
    code: 'IT_HELP_DESK_TECH',
    name: 'Help Desk Technician',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_SUPPORT_SPECIALIST',
    name: 'IT Support Specialist',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_DESKTOP_SUPPORT_TECH',
    name: 'Desktop Support Technician',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_TECHNICAL_SUPPORT_REP',
    name: 'Technical Support Representative',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_NETWORK_TECHNICIAN',
    name: 'Network Technician',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_NETWORK_ADMINISTRATOR',
    name: 'Network Administrator',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_SYSTEMS_ADMINISTRATOR',
    name: 'Systems Administrator',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  { code: 'IT_COORDINATOR', name: 'IT Coordinator', industry: 'IT_TECHNOLOGY', department: null },
  {
    code: 'IT_PROJECT_MANAGER',
    name: 'IT Project Manager',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_BUSINESS_ANALYST',
    name: 'Business Analyst',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  { code: 'IT_DATA_ANALYST', name: 'Data Analyst', industry: 'IT_TECHNOLOGY', department: null },
  {
    code: 'IT_DATABASE_ADMINISTRATOR',
    name: 'Database Administrator',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_CYBERSECURITY_ANALYST',
    name: 'Cybersecurity Analyst',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_SOC_ANALYST',
    name: 'Security Operations Center (SOC) Analyst',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_CLOUD_SUPPORT_SPECIALIST',
    name: 'Cloud Support Specialist',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_CLOUD_ENGINEER',
    name: 'Cloud Engineer',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_DEVOPS_ENGINEER',
    name: 'DevOps Engineer',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_SOFTWARE_DEVELOPER',
    name: 'Software Developer',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_FRONT_END_DEVELOPER',
    name: 'Front-End Developer',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_BACK_END_DEVELOPER',
    name: 'Back-End Developer',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_FULL_STACK_DEVELOPER',
    name: 'Full-Stack Developer',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_QA_SOFTWARE_TESTER',
    name: 'QA / Software Tester',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_APPLICATION_SUPPORT',
    name: 'Application Support Specialist',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_ERP_CRM_SUPPORT',
    name: 'ERP / CRM Support Specialist',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_FIELD_TECHNICIAN',
    name: 'IT Field Technician',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_DATA_CENTER_TECHNICIAN',
    name: 'Data Center Technician',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_ASSET_MANAGEMENT_SPECIALIST',
    name: 'IT Asset Management Specialist',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_TECHNICAL_PROJECT_COORDINATOR',
    name: 'Technical Project Coordinator',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  { code: 'IT_PRODUCT_OWNER', name: 'Product Owner', industry: 'IT_TECHNOLOGY', department: null },
  { code: 'IT_SCRUM_MASTER', name: 'Scrum Master', industry: 'IT_TECHNOLOGY', department: null },
  { code: 'IT_MANAGER', name: 'IT Manager', industry: 'IT_TECHNOLOGY', department: null },
  {
    code: 'IT_DIRECTOR_OF_IT',
    name: 'Director of IT',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
  {
    code: 'IT_CTO_TECH_LEADERSHIP',
    name: 'CTO / Technology Leadership',
    industry: 'IT_TECHNOLOGY',
    department: null,
  },
]
