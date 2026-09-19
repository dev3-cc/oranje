/**
 * El clausulado del acuerdo de servicio, transcrito del contrato vigente que
 * Oranje firma con sus hoteles (Courtyard & Fairfield Lithia Springs, marzo de
 * 2023). Vive aparte del componente porque son doscientas líneas de prosa
 * legal que no cambian nunca.
 *
 * Va en INGLÉS a propósito: es el documento que firma un hotel en Georgia y la
 * ley aplicable es la de ese estado (cláusula 16). Traducirlo cambiaría el
 * texto que las partes acordaron.
 *
 * Los huecos entre llaves los rellena `ContractDocument` con los datos de la
 * propuesta: `{startDate}`, `{endDate}` y `{provider}`.
 */
export interface ContractClause {
  title: string
  paragraphs: string[]
}

export const CONTRACT_CLAUSES: ContractClause[] = [
  {
    title: 'TERM',
    paragraphs: [
      'Beginning as of {startDate} and during a period of one (1) Year (“Term”), unless prior finished pursuant to {endDate} hereof, “Service Provider” makes agreement that they will serve as a Service Provider to Company. This Agreement may be changed or extended for any period at any time, as may be agreed by the parties.',
    ],
  },
  {
    title: 'DUTIES',
    paragraphs: [
      '(a) Company hereby engages “Service Provider” and “Service Provider” agrees to perform the following duties and responsibilities as described on Exhibit “A” hereto (““Service Provider” Services”).',
      '(b) “Service Provider” guarantees to Company that it is under no contractual or other limitations or compulsions which are not in agreement with the carrying out this Agreement, or which will obstruct the performance of their duties.',
      '(c) In performing services, “Service Provider” shall obey, to the best of their information, with all business manners, regulatory, health and safety guidelines recognized by Company and/or applicable laws and regulations.',
      '(d) “Service Provider” will use the best efforts to provide the same individuals to the hotel and minimize staff turnover on a daily basis.',
    ],
  },
  {
    title: 'SERVICE FEE',
    paragraphs: [
      '(a) According to the agreement terms hereof, Company shall pay {provider} pursuant to the Contract Cost as described on Exhibit “A” hereto. “Service Provider” shall present weekly invoices for services provided and Company agrees to make monthly payments no later than every 15th days after the services is being delivered. Amounts owed under this section shall be due upon receipt of an invoice, or in any event no later than the 15th day after delivered. Late charges will commence beginning of 35 days after an invoice has been submitted and not paid. A one-time late fee in the amount of 5% of the total outstanding balance for each unpaid (partial or total) invoice will accrue on the 35th day and interest will accrue at a rate equal of 1.5% per month until the outstanding balance is paid in full with the date of the accrual being the date of invoice.',
      '(b) “Service Provider” agrees that all “Service Provider” services will be rendered by itself as a self-governing contractor and that this Agreement does not generate an employer-employee relationship between “Service Provider” and Company. “Service Provider” or its employees shall have no right to receive any employee benefits including, but not limited to, health and accident insurance, life insurance, sick leave and/or vacation. “Service Provider” makes agreement to pay all taxes including sales, income and employment taxes due in respect of the contract cost and to indemnify Company in the event Company is required to pay any such taxes on behalf of “Service Provider”.',
      '(c) Georgia has no state labor laws specific to overtime pay. As a result, the federal wage and hour law (FLSA) applies and requires overtime pay to covered, nonexempt employees under that law. An employer that either requires or permits an employee to work overtime is required to pay that employee overtime for those hours. Overtime is considered any hours worked over 40 hours per workweek, and the pay for overtime hours is at least one-and-a-half times an employee’s regular pay rate.',
    ],
  },
  {
    title: 'EARLY TERMINATION OF THE TERM',
    paragraphs: [
      '(a) The initial Term of this Agreement shall be for a period of one (1) Year, commencing as of the Effective Date. Thereafter, this Agreement can be terminated by either party with a thirty (30) day written notice at any time during the initial term without any termination fees. This agreement shall automatically be extended for successive one-year terms under the same terms and conditions, unless one party submits written notice of its intent to terminate the Services Agreement without any termination fees.',
      'If “Service Provider” willingly stops performing its duties, or becomes unable to perform its Duties, the provisions of Sections 5 and 6 shall specifically survive the termination of this Services Agreement.',
      'Notwithstanding any other provision of this Services Agreement to the contrary, either party shall have the right, in its sole discretion, to terminate this Services Agreement Immediately upon written notice to the other party upon the occurrence of any of the following: I. The initiation of a bankruptcy or insolvency proceeding by any party to this Agreement.',
      '(b) Upon termination, neither party shall have any further responsibilities under this Agreement, except for the compulsions which by their terms endure this termination hereof.',
    ],
  },
  {
    title: 'RESTRICTED ACTIVITIES',
    paragraphs: [
      'During the Term and for a period of One (1) year thereafter, Company will not directly or indirectly:',
      '(a) Solicit or request any employee of “Service Provider” to work in any capacity for the Company without written consent of “Service Provider”;',
      '(b) Otherwise request, through any other vendor or entity, that any employee of “Service Provider” to work in any capacity for Company without “Service Provider” written consent.',
      '(c) Company shall be responsible for all matters of security in the hotel premises.',
    ],
  },
  {
    title: 'PROPRIETARY RIGHTS',
    paragraphs: [
      '(a) Definitions. For the purposes of the terms set forth below shall have the following meanings: i. Confidential information. For the purposes of this Agreement, Confidential Information shall mean and collectively include: all information involving the business, plans and/or technology of “Service Provider” including, but not limited to technological information including techniques, tactics, procedures, conditions, uniqueness, assess, raw data, records, files, formulations, tools design, know-how, knowledge, and trade secrets; developmental, promotion, sales, customer, trader, consulting relationship information, in service, performance, and cost information, computer programming system whether in physical or intangible form, and all record bearing media containing or disclosing the preceding information and techniques including, written business plans, patents and patent applications, grant applications, notes, and memorandum, whether in writing or presented, stored or maintained in or by electronic, magnetic or other means.',
      'In spite of the previous, the term “Confidential Information” shall not include any information which: (A) can be established to have been in the public area or was publicly known or accessible earlier to the date of the disclosure to “Service Provider”; (B) can be established in writing to have been lawfully in the ownership of “Service Provider” prior to the disclosure of such information to “Service Provider” by Company; (C) becomes part of the public domain or publicly known or available by publication or otherwise, not due to any unauthorized act or omission on the part of “Service Provider”; or (D) is supplied to “Service Provider” by a third party without binder of confidentiality, so long as that such third party has no responsibility to Company or any or its associated companies to maintain such information in confidence.',
      '(b) Non Disclosure to Third Parties. Apart from as required by this Agreement, the Company shall not, at any time now or in the future, openly or indirectly, use, publish, distribute or otherwise make known any Confidential Information, thoughts, or ideas to any third party without the prior written consent of “Service Provider”.',
      '(c) Documents, etc. All documents, diskettes, tapes, practical manuals, guides, stipulations, plans, drawings, designs and similar materials, properly maintained lists of present, past or prospective customers, customer offers, request to submit proposals, price lists and data relating to the pricing of Company products and services, records, notebooks and all other materials containing Confidential Information or Information about concepts or ideas (including all copies and reproductions thereof), that come into “Service Provider”’s control or control by reason of “Service Provider”’s performance of the link, whether prepared by “Service Provider” or others: (a) are the property of the Company, (b) will not be used by “Service Provider” in any way other than in connection with the performance of his/her Duties, (c) will not be provided or shown to any third party by “Service Provider”, (d) will not be removed from Company’s or “Service Provider”’s premises (except as “Service Provider” Duties require), and (e) at the termination (for whatever reason), or “Service Provider”’s relationship with Company, will be left with, or forthwith returned by “Service Provider” to Company.',
      '(d) Patents, etc. “Service Provider” makes agreement that the Company is and shall remain the elite owner of the Confidential Information and concepts and ideas. Any interest in copyrights, discoveries, technological improvements, trade names, brand, services marks, copyrights, copyrightable works, developments, designs, procedures, methods, know-how, data and analysis, whether registrable or not (“Developments”), which “Service Provider”, as a result of providing services to Company under this agreement, may visualize or develop, shall: (i) immediately be brought to the notice of Company by “Service Provider” and (ii) belongs entirely to Company. No license or transportation of any such rights to “Service Provider” is allowed or implied under this Agreement.',
      '(e) Assignment. “Service Provider” hereby assigns and, to the extent any such assignment cannot be made at present, hereby makes agreement to allocate to Company, without additional return, all of their rights, identify and interest in and to all perceptions, ideas, and developments. “Service Provider” will execute all documents and perform all lawful acts which Company considers necessary or advisable to secure its rights hereunder and to carry out the intent of this Agreement.',
    ],
  },
  {
    title: 'EQUITABLE RELIEF',
    paragraphs: [
      '“Service Provider” makes agreement that any breach of clauses mentioned above by them would ground irrevocable harm to Company and that, in case of such breach, Company shall have, in addition to any and all remedies of law, the right to an order, definite performance or other reasonable benefit to prevent the breach or susceptible violation of “Service Provider”’s obligations hereunder.',
    ],
  },
  {
    title: 'SEVERABILITY; REFORMATION',
    paragraphs: [
      'In case any one or more of the conditions or parts of a stipulation included in his Agreement shall, for any cause, be held to be unacceptable, unlawful or unenforceable in any respect, such invalidity, misconduct or unenforceability shall not affect any other condition or part of a condition of this Agreement; and this Agreement shall, to the fullest extent lawful, be reformed and construed as if such invalid or illegal or unenforceable provision, or part of a provision, had never been included herein, and such provision or part reformed so that it would be applicable, lawful and enforceable to the maximum degree possible. Without limiting the previous, if any condition (or part of provision) included in this Agreement shall for any reason be held to be excessively broad as to duration, activity or subject, it shall be interpreted by limiting and reducing it, so as to be enforceable to the fullest level compatible with then existing applicable law.',
    ],
  },
  {
    title: 'ASSIGNMENT',
    paragraphs: [
      '“Service Provider” may assign this Agreement to a third party with the prior written consent of Company so long as the third party is able and agrees in writing to act under the terms of, and assume the responsibilities seth for in this Agreement.',
    ],
  },
  {
    title: 'HEADINGS',
    paragraphs: [
      'Headings and subheadings are for expediency only and shall not be considered to be a part of this Agreement.',
    ],
  },
  {
    title: 'AMENDMENTS',
    paragraphs: [
      'This Agreement may be altered or customized, in while or in part, only by an instrument in writing approved by all parties hereto. Any adjustment, permission, verdict, waiver or other action to be made, taken or given by the Company related to the Agreement shall be made, taken or given on behalf of the Company only by power of the Company’s Directors.',
    ],
  },
  {
    title: 'NOTICES',
    paragraphs: [
      'Any notices or other communications required hereunder shall be in writing and shall be considered given when distributed in person or when posted, by qualified or registered first class mail, postage prepaid, return receipt requested, addressed to the parties at their addresses mentioned in the foreword to this Agreement or to such other addresses of which a party shall have notified the others in harmony with the provisions of this clause.',
    ],
  },
  {
    title: 'COUNTERPARTS',
    paragraphs: [
      'This Agreement may be executed in two or more complements, each of which shall constitute an original and all of which shall be considered a single agreement.',
    ],
  },
  {
    title: 'SURVIVAL',
    paragraphs: [
      'The provisions of concerned sections of this Agreement shall endure the ending of the Term.',
    ],
  },
  {
    title: 'WAIVER OF BREACH',
    paragraphs: [
      'Failure to insist upon strict compliance with any provision of this Services Agreement shall not operate as a waiver with respect to any subsequent or other failure, nor shall such failure to act constitute or be construed or interpreted as a modification or amendment of this Services Agreement.',
    ],
  },
  {
    title: 'APPLICABLE LAW',
    paragraphs: [
      'This Services Agreement shall be governed and controlled by the laws of the State of Georgia, without reference to its conflicts of laws principles.',
    ],
  },
  {
    title: 'ARBITRATION',
    paragraphs: [
      'The Parties agree to use good faith efforts to resolve any dispute, controversy or claim arising out of or in connection with, or relating to, this Services Agreement or any breach or alleged breach hereof (“Dispute”) promptly and fairly. If the Parties are unable to resolve a Dispute by negotiation, the parties agree to submit it non-binding mediation conducted by a mutually selected mediator or, is the option of either party, by the American Arbitration Association (“AAA”). If such mediation is unsuccessful in resolving the Dispute, then such Dispute shall then be submitted to, and settled by arbitration in the City of Atlanta, State of Georgia, pursuant to the commercial arbitration rules then in effect of the AAA (or at any time or at any other place or under any other form of arbitration mutually acceptable to the parties involved). Any award rendered shall be final and conclusive upon the parties and a judgment thereon may be entered in the highest court of the forum, state or federal, having jurisdiction. The expenses of the arbitration, including the cost of experts, evidence and counsel fees, shall be borne by the unsuccessful or losing party in the dispute, controversy or claim that is settled by such arbitration.',
    ],
  },
  {
    title: 'EQUAL WEIGHT',
    paragraphs: [
      'The Parties agree, understand and acknowledge that each and every clause, provision, section, paragraph, term, covenant and condition contained in this Services Agreement is separate and distinct from any and all other clauses, provisions, sections, paragraphs, terms, covenants and conditions contained in this Services Agreement, and further agree, understand and acknowledge that each of the foregoing shall have equal weight, merit and importance among them and shall not have greater or lesser weight, merit or importance than any other clause, provision, section, paragraph, term covenant and/or condition contained in this Service Agreement.',
    ],
  },
  {
    title: 'REMEDIES',
    paragraphs: [
      'All remedies of the Parties hereunder are cumulative, are in addition to any other remedies provided for by law, and may, to the extent permitted by law, be exercised concurrently or separately. The exercise of any one remedy shall not be deemed to be an election of such remedy or to preclude the exercise of any other remedy. The prevailing party in any legal action brought by one party against the other and arising out of this Services Agreement shall be entitled, in addition to any other rights and remedies it may have, to reimbursement for its expenses, including court costs and reasonable attorney’s fees.',
    ],
  },
  {
    title: 'ENTIRE AGREEMENT',
    paragraphs: [
      'This instrument contains the entire agreement between the Parties regarding the engagement of “Service Provider” by the Company. It may not be changed orally, but only by an agreement in writing, signed by the Party against whom enforcement of any waiver, change, modification, extension or discharge is sought.',
    ],
  },
]
