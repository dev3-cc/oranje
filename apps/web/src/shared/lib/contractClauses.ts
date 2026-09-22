/**
 * El clausulado del acuerdo de servicio, transcrito del machote real que
 * Oranje firma con sus hoteles (Strategic Deployment, LLC — Service Agreement,
 * recibido de Hugo el 2026-09-22, reemplaza el machote anterior de Courtyard
 * & Fairfield Lithia Springs). Vive aparte del componente porque son
 * doscientas líneas de prosa legal que no cambian nunca.
 *
 * Va en INGLÉS a propósito: es el documento que firma un hotel en Georgia y la
 * ley aplicable es la de ese estado (cláusula 17). Traducirlo cambiaría el
 * texto que las partes acordaron.
 *
 * Los huecos entre llaves los rellena `ContractDocument` con los datos de la
 * propuesta: `{startDate}` y `{endDate}`.
 */
export interface ContractClause {
  title: string
  paragraphs: string[]
}

export const CONTRACT_CLAUSES: ContractClause[] = [
  {
    title: 'TERM AND RENEWAL',
    paragraphs: [
      '(a) The initial term begins {startDate} and continues through {endDate} (“Initial Term”), unless terminated earlier as expressly permitted by this Agreement.',
      '(b) After the Initial Term, this Agreement automatically renews for successive one-year terms unless either Party gives at least thirty (30) days’ written notice before the end of the then-current term.',
      '(c) After the Initial Term, either Party may terminate without cause upon thirty (30) days’ written notice.',
    ],
  },
  {
    title: 'SERVICES AND RESPONSIBILITIES',
    paragraphs: [
      '(a) Company engages Service Provider to furnish personnel and related staffing services described in Exhibit A. Personnel supplied by Service Provider remain employees of Service Provider.',
      '(b) Service Provider is responsible for payroll administration, payroll taxes, workers’ compensation coverage, general liability coverage, I-9 compliance, and other employer obligations applicable to its employees, subject to applicable law.',
      '(c) Service Provider will provide general employment and safety-program orientation. Company is responsible for property-specific training, task direction, daily supervision, workplace safety, security, equipment, chemicals, tools, premises conditions, and property-specific procedures.',
      '(d) Company shall maintain a workplace compliant with applicable safety and employment laws, disclose known hazards, provide appropriate equipment and protective measures, and promptly report injuries, accidents, complaints, or incidents involving assigned personnel.',
      '(e) Company shall not discriminate against, harass, retaliate against, or permit unlawful treatment of assigned personnel and shall cooperate with Service Provider in investigating complaints or incidents.',
    ],
  },
  {
    title: 'SERVICE FEES, INVOICING AND PAYMENT',
    paragraphs: [
      '(a) Company shall pay the rates and charges stated in Exhibit A. Service Provider will issue invoices weekly. Each invoice is due within thirty (30) calendar days from the invoice date (“Net 30”).',
      '(b) Company shall review weekly time records promptly. Any objection to hours must be delivered in writing, with reasonable detail, within three (3) business days after receipt. If no timely objection is received, the time record is deemed accepted for billing purposes.',
      '(c) Any invoice dispute must be submitted in writing within five (5) business days after receipt and identify the specific disputed amount and basis. Amounts not timely disputed are deemed accepted. Company shall timely pay all undisputed amounts.',
      '(d) A one-time late charge of five percent (5%) of the unpaid balance will be assessed on the thirty-fifth (35th) day after the invoice date. Interest will also accrue at one and one-half percent (1.5%) per month, or the maximum lawful rate if lower, from the invoice date until paid in full.',
      '(e) Company shall reimburse reasonable collection costs, arbitration or court costs, and reasonable attorneys’ fees incurred to collect overdue undisputed amounts, to the extent permitted by law.',
      '(f) If an undisputed invoice remains unpaid more than five (5) days after its due date, Service Provider may suspend some or all Services upon written notice, without liability and without such suspension constituting breach. Suspension does not waive Company’s payment obligations.',
      '(g) Upon expiration or termination for any reason, all outstanding invoices, accrued charges, approved but unbilled hours, late fees, interest, and other amounts owed become immediately due and payable.',
    ],
  },
  {
    title: 'RATES AND COST ADJUSTMENTS',
    paragraphs: [
      '(a) Rates in Exhibit A are based on stated pay rates, payroll burden, insurance costs, and applicable legal requirements in effect when established.',
      '(b) Service Provider may adjust bill rates upon written notice to reflect increases in minimum wage, payroll taxes, workers’ compensation premiums, unemployment taxes, legally mandated benefits, insurance costs, or other governmental or statutory employment costs.',
      '(c) Any Company-requested increase in employee pay rates will result in a corresponding adjustment to the applicable bill rate using the agreed markup methodology unless otherwise agreed in writing.',
      '(d) Any other discretionary rate change requires written agreement of the Parties.',
    ],
  },
  {
    title: 'OVERTIME AND SCHEDULING',
    paragraphs: [
      '(a) Overtime shall be paid to covered nonexempt employees at one time and a half after completing 40 worked hours. Company is responsible for the applicable overtime bill rate for overtime hours that Company or its managers or supervisors request, authorize, permit, suffer, or allow to be worked.',
      '(b) Company shall designate persons authorized to request personnel and approve schedules. Company’s internal failure to obtain approval does not relieve Company of payment responsibility for hours actually worked at Company’s request or with Company’s knowledge.',
      '(c) Unless otherwise agreed in writing, the overtime bill rate will be calculated by applying the Exhibit A service markup to Service Provider’s actual overtime wage cost for the employee, together with applicable payroll burden and legally required costs.',
    ],
  },
  {
    title: 'TERMINATION FOR CAUSE',
    paragraphs: [
      '(a) Either Party may terminate immediately upon written notice if the other Party becomes subject to bankruptcy or insolvency proceedings, ceases business operations, or materially breaches this Agreement and, where reasonably curable, fails to cure within ten (10) calendar days after written notice.',
      '(b) Service Provider may immediately suspend or terminate Services for nonpayment under Section 3, unsafe working conditions, unlawful instructions, threats to assigned personnel, or circumstances reasonably presenting material legal, safety, or financial risk.',
      '(c) Payment, restrictions, confidentiality, intellectual property, indemnification, limitation of liability, dispute resolution, and provisions that by their nature should survive will survive termination.',
    ],
  },
  {
    title: 'RESTRICTED ACTIVITIES; NON-SOLICITATION; CONVERSION',
    paragraphs: [
      '(a) During the Term and for one (1) year after an employee’s last assignment with Company, Company shall not, without Service Provider’s prior written consent, directly or indirectly solicit, hire, employ, engage, or retain any employee introduced or supplied by Service Provider, whether directly, through an affiliate, contractor, another staffing provider, or other third party.',
      '(b) Company shall not request or arrange for a Service Provider employee to be transferred to another vendor or entity for the purpose of continuing substantially similar services for Company.',
      '(c) If Service Provider permits a direct hire or conversion, the Parties shall agree in writing to a commercially reasonable conversion or placement fee before the employee is hired or transferred. Nothing here prohibits conduct that cannot lawfully be restricted.',
      '(d) The Parties intend this Section to protect Service Provider’s legitimate recruiting, placement, training, and workforce-development interests and to be enforced only to the maximum extent permitted by applicable law.',
    ],
  },
  {
    title: 'CONFIDENTIALITY',
    paragraphs: [
      '(a) “Confidential Information” means nonpublic business, operational, financial, technical, customer, employee, pricing, recruiting, software, process, trade-secret, and other proprietary information disclosed by one Party to the other.',
      '(b) Confidential Information excludes information lawfully known without restriction before disclosure, information becoming public through no breach, information lawfully received from a third party without confidentiality duty, and information independently developed without use of the other Party’s Confidential Information.',
      '(c) The receiving Party shall use Confidential Information only as necessary to perform this Agreement and shall not disclose it except to personnel, advisers, insurers, or service providers with a need to know and appropriate confidentiality obligations, or as required by law.',
      '(d) Upon termination or written request, each Party shall return or destroy the other Party’s Confidential Information, subject to lawful record-retention obligations and routine backup systems.',
    ],
  },
  {
    title: 'INTELLECTUAL PROPERTY AND PROPRIETARY MATERIALS',
    paragraphs: [
      '(a) Each Party retains all rights in intellectual property, materials, systems, processes, know-how, software, methods, templates, data, trademarks, trade names, and other proprietary rights owned, developed, or acquired before this Agreement or independently of the specific Services (“Background IP”).',
      '(b) Service Provider specifically retains ownership of its staffing methods, recruiting methods and sources, employee and candidate databases, pricing methodologies, training materials, operational procedures, quality-control systems, scheduling methods, software, technology, forms, templates, analytics, and know-how, including improvements developed while performing Services.',
      '(c) Company retains ownership of its own Background IP and Company-specific confidential materials.',
      '(d) No Background IP transfers under this Agreement. Any Company-specific deliverable expressly commissioned outside ordinary staffing services will be governed by a separate written statement of work addressing ownership and license rights.',
      '(e) Neither Party may publicly use the other Party’s name, trademarks, logos, or branding without prior written consent, except as necessary for ordinary internal administration.',
    ],
  },
  {
    title: 'INDEMNIFICATION',
    paragraphs: [
      '(a) Service Provider shall indemnify, defend, and hold harmless Company from third-party claims, damages, liabilities, and reasonable costs to the extent caused by Service Provider’s negligence, willful misconduct, material breach, or failure to satisfy employer obligations expressly assigned to Service Provider.',
      '(b) Company shall indemnify, defend, and hold harmless Service Provider and its affiliates, officers, employees, and agents from third-party claims, damages, liabilities, and reasonable costs to the extent caused by Company’s negligence, willful misconduct, unsafe premises or equipment, property-specific supervision or instructions, harassment or discrimination by Company personnel, security incidents within Company’s control, or Company’s material breach.',
      '(c) The indemnified Party shall promptly notify the indemnifying Party and reasonably cooperate. The indemnifying Party may control the defense but may not settle in a manner admitting fault by or imposing nonmonetary obligations on the indemnified Party without written consent.',
    ],
  },
  {
    title: 'LIMITATION OF LIABILITY',
    paragraphs: [
      '(a) To the maximum extent permitted by law, neither Party shall be liable to the other for consequential, incidental, special, exemplary, or punitive damages, or lost profits or lost business, except to the extent payable to a third party under a covered indemnification claim.',
      '(b) Except for payment obligations, fraud, willful misconduct, confidentiality or intellectual-property violations, indemnification obligations, or liabilities that cannot lawfully be limited, Service Provider’s aggregate contractual liability shall not exceed the total service fees paid or payable by Company during the six (6) months immediately preceding the event giving rise to the claim.',
    ],
  },
  {
    title: 'INSURANCE AND WORKPLACE COOPERATION',
    paragraphs: [
      '(a) Service Provider shall maintain workers’ compensation and general liability insurance consistent with applicable law and its ordinary business practices.',
      '(b) Company shall maintain commercially reasonable insurance appropriate to its hotel operations, including premises and operational risks.',
      '(c) Each Party shall reasonably cooperate in incident investigations, insurance claims, workers’ compensation matters, and legally required reporting.',
    ],
  },
  {
    title: 'EMPLOYEE SCREENING',
    paragraphs: [
      '(a) Service Provider will conduct employee screening consistent with its then-current written policies, accepted client requirements, and applicable law. Screening may include I-9 verification, criminal background screening, and drug screening where applicable and lawful.',
      '(b) No screening process guarantees against employee misconduct, and Company remains responsible for on-site supervision, access controls, security, and property-specific safeguards.',
    ],
  },
  {
    title: 'INDEPENDENT CONTRACTOR RELATIONSHIP',
    paragraphs: [
      '(a) Service Provider is an independent contractor. Nothing creates a partnership, joint venture, agency, or employer-employee relationship between Company and Service Provider.',
      '(b) Assigned personnel remain employees of Service Provider for payroll and employment-administration purposes, while Company retains responsibility for property-specific direction and supervision as stated in Section 2.',
    ],
  },
  {
    title: 'ASSIGNMENT',
    paragraphs: [
      '(a) Service Provider may assign this Agreement to an affiliate or successor in connection with a merger, reorganization, sale of substantially all assets, or similar transaction, or to another qualified entity that assumes Service Provider’s obligations in writing.',
      '(b) Company may not assign this Agreement without Service Provider’s prior written consent, except to a successor acquiring substantially all of the hotel operation and assuming all payment and contractual obligations in writing.',
    ],
  },
  {
    title: 'NOTICES',
    paragraphs: [
      '(a) Formal notices must be in writing and may be delivered personally, by nationally recognized overnight courier, by certified or registered mail, or by email to a designated notice address. Email notice is effective when sent if the sender receives no delivery-failure notice.',
    ],
  },
  {
    title: 'DISPUTE RESOLUTION; GOVERNING LAW',
    paragraphs: [
      '(a) This Agreement is governed by the laws of the State of Georgia, without regard to conflict-of-law principles.',
      '(b) The Parties shall first use good-faith direct negotiation. If unresolved, they shall participate in non-binding mediation in Atlanta, Georgia, with a mutually selected mediator or through the American Arbitration Association (“AAA”).',
      '(c) If mediation does not resolve the dispute, it shall be finally settled by binding arbitration in Atlanta, Georgia under the AAA Commercial Arbitration Rules then in effect, unless the Parties agree otherwise in writing.',
      '(d) The prevailing Party in arbitration or other permitted legal proceedings shall be entitled to recover reasonable attorneys’ fees and costs to the extent permitted by law. The arbitrator shall determine prevailing-party status and allocation of arbitration costs.',
    ],
  },
  {
    title: 'SEVERABILITY AND REFORMATION',
    paragraphs: [
      'If any provision is held invalid or unenforceable, the remaining provisions remain effective. Any overly broad restriction shall be reformed and enforced to the maximum extent permitted by applicable law.',
    ],
  },
  {
    title: 'WAIVER; REMEDIES',
    paragraphs: [
      'Failure to enforce any provision on one occasion is not a waiver on a later occasion. Except where this Agreement expressly provides otherwise, available remedies are cumulative.',
    ],
  },
  {
    title: 'AMENDMENTS; ENTIRE AGREEMENT; COUNTERPARTS',
    paragraphs: [
      'This Agreement, including Exhibit A, is the entire agreement concerning the Services and supersedes prior understandings concerning the same subject matter. Any amendment, waiver, or modification must be in writing and signed by authorized representatives of both Parties. This Agreement may be executed in counterparts and by electronic signature.',
    ],
  },
  {
    title: 'AUTHORITY',
    paragraphs: [
      'Each person signing represents that he or she is authorized to bind the Party on whose behalf the signature is made.',
    ],
  },
]
