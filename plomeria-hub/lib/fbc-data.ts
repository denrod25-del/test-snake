/**
 * Local stand-in for the shared @bsymbolic/fbc-data package.
 *
 * In the real B. Symbolic monorepo this is published as a workspace
 * package consumed by both code.bsymbolic.com (public reference) and
 * Plomería Hub (paid product). Here it ships inline so the app builds
 * and deploys standalone. The integration-kit components import it via
 * the `@bsymbolic/fbc-data` path alias (see tsconfig.json), so nothing
 * in components/code/ had to change.
 *
 * Content is real Florida Building Code – Plumbing (FBC-P) material,
 * which adopts the International Plumbing Code with Florida amendments.
 * Always confirm against the current adopted edition before relying on
 * it for an actual installation or inspection.
 */

export type Lang = "en" | "es";

export interface LocalizedText {
  en: string;
  es: string;
}

export interface Section {
  /** Stable identifier used in URLs and the database (e.g. "909.1"). */
  id: string;
  /** Human-facing section number as printed in the code book. */
  section: string;
  title: LocalizedText;
  codeSummary: LocalizedText;
  plainEnglish: LocalizedText;
  fieldNotes: LocalizedText;
  /** Florida-specific amendment or practical note, when one applies. */
  florida?: LocalizedText;
}

export const SECTIONS: Section[] = [
  {
    id: "909.1",
    section: "909.1",
    title: {
      en: "Distance of Trap From Vent",
      es: "Distancia del Sifón al Respiradero",
    },
    codeSummary: {
      en: "Each fixture trap must have a vent within the maximum developed length set by the trap arm size: 5 ft for 1¼ in, 6 ft for 1½ in, 8 ft for 2 in, 12 ft for 3 in, and 16 ft for 4 in pipe. The fixture drain must also fall no more than one pipe diameter between the trap weir and the vent connection.",
      es: "Cada sifón de artefacto debe tener un respiradero dentro de la longitud desarrollada máxima según el diámetro del brazo del sifón: 5 pies para 1¼ pulg, 6 pies para 1½ pulg, 8 pies para 2 pulg, 12 pies para 3 pulg y 16 pies para 4 pulg. Además, el desagüe no debe caer más de un diámetro de tubería entre el vertedero del sifón y la conexión del respiradero.",
    },
    plainEnglish: {
      en: "Put the vent close enough to the trap. If the run from the trap to the vent is too long, the draining water siphons the trap dry and sewer gas comes back into the room. Bigger pipe is allowed to run farther.",
      es: "Coloca el respiradero lo suficientemente cerca del sifón. Si el tramo entre el sifón y el respiradero es muy largo, el agua al desaguar succiona y vacía el sifón, dejando entrar gases de alcantarilla al ambiente. La tubería de mayor diámetro puede ir más lejos.",
    },
    fieldNotes: {
      en: "Measure developed length along the centerline of the pipe, not straight-line distance — every fitting adds run. The one-diameter fall rule is what catches most installs: a 2 in trap arm can drop only 2 in over its length before the vent.",
      es: "Mide la longitud desarrollada por el eje central de la tubería, no en línea recta: cada accesorio suma tramo. La regla de la caída de un diámetro es la que falla en la mayoría de las instalaciones: un brazo de 2 pulg solo puede bajar 2 pulg en todo su tramo antes del respiradero.",
    },
    florida: {
      en: "Florida's high water table and slab-on-grade construction push more drainage into the slab, so trap-arm length is a frequent rough-in inspection flag. Air admittance valves (AAVs) are accepted under FBC-P 919 where a conventional vent is impractical, but never as a substitute for a required vent stack.",
      es: "El nivel freático alto de Florida y la construcción sobre losa empujan más drenaje dentro de la losa, por lo que la longitud del brazo del sifón es una observación frecuente en la inspección de plomería en bruto. Las válvulas de admisión de aire (AAV) se aceptan según FBC-P 919 donde un respiradero convencional no es práctico, pero nunca como sustituto de una columna de ventilación requerida.",
    },
  },
  {
    id: "903.1",
    section: "903.1",
    title: {
      en: "Vent Terminal — Roof Extension",
      es: "Terminal de Ventilación — Extensión sobre el Techo",
    },
    codeSummary: {
      en: "Open vent pipes that extend through a roof must terminate at least 6 in above the roof surface, or 6 in above the anticipated snow accumulation where applicable. Where a roof is used for anything other than weather protection, the vent must rise at least 7 ft above the roof.",
      es: "Las tuberías de ventilación abiertas que atraviesan el techo deben terminar al menos 6 pulg sobre la superficie del techo, o 6 pulg sobre la acumulación de nieve prevista donde aplique. Donde el techo se use para algo más que protección contra la intemperie, el respiradero debe elevarse al menos 7 pies sobre el techo.",
    },
    plainEnglish: {
      en: "The vent has to stick up out of the roof far enough that debris, water, or people on the roof won't block it. On a normal roof that's 6 inches; on a roof people walk on it's 7 feet.",
      es: "El respiradero debe sobresalir del techo lo suficiente para que residuos, agua o personas no lo obstruyan. En un techo normal son 6 pulgadas; en un techo transitable son 7 pies.",
    },
    fieldNotes: {
      en: "Keep terminals at least 10 ft from, or 3 ft above, any door, window, or air intake (FBC-P 904.5) so sewer gas isn't drawn back inside. Flash every penetration; a leaking vent boot is the most common roof callback.",
      es: "Mantén las terminales al menos a 10 pies de distancia, o 3 pies por encima, de cualquier puerta, ventana o toma de aire (FBC-P 904.5) para que no se reintroduzcan gases de alcantarilla. Sella (flashing) cada penetración; un collarín de respiradero con fuga es el reclamo de techo más común.",
    },
    florida: {
      en: "Snow accumulation is a non-issue statewide, so the 6 in minimum governs. The bigger Florida concern is wind uplift and water intrusion at the penetration — use a code-approved flashing rated for the roof's high-velocity hurricane zone (HVHZ) where applicable.",
      es: "La acumulación de nieve no es un factor en todo el estado, por lo que rige el mínimo de 6 pulg. La mayor preocupación en Florida es el levantamiento por viento y la entrada de agua en la penetración: usa un sellado aprobado por código y clasificado para la zona de huracanes de alta velocidad (HVHZ) cuando corresponda.",
    },
  },
  {
    id: "1002.1",
    section: "1002.1",
    title: {
      en: "Fixture Traps — One Trap Per Fixture",
      es: "Sifones de Artefactos — Un Sifón por Artefacto",
    },
    codeSummary: {
      en: "Each plumbing fixture must be separately trapped by a water-seal trap placed as close as possible to the fixture outlet. The distance from the fixture outlet to the trap weir may not exceed 24 in. Double trapping a fixture is prohibited.",
      es: "Cada artefacto sanitario debe tener su propio sifón con sello de agua, colocado lo más cerca posible de la salida del artefacto. La distancia desde la salida del artefacto hasta el vertedero del sifón no puede exceder 24 pulg. Está prohibido el doble sifonado de un artefacto.",
    },
    plainEnglish: {
      en: "Every fixture gets exactly one trap, and it goes right under the fixture. One trap, never two in series, and never one trap shared by separate fixtures (with limited exceptions like a three-compartment sink).",
      es: "Cada artefacto lleva exactamente un sifón, ubicado justo debajo. Un solo sifón, nunca dos en serie, y nunca un sifón compartido por artefactos separados (con excepciones limitadas como un fregadero de tres compartimentos).",
    },
    fieldNotes: {
      en: "Double-trapping creates an air lock between the two seals and the fixture won't drain. A common rough-in mistake is adding a trap in the wall when the fixture already has an integral trap (like a water closet) — the toilet's trap is the trap.",
      es: "El doble sifonado crea una bolsa de aire entre los dos sellos y el artefacto no desagua. Un error común es añadir un sifón en la pared cuando el artefacto ya trae sifón integral (como un inodoro): el sifón del inodoro es el sifón.",
    },
  },
  {
    id: "604.4",
    section: "604.4",
    title: {
      en: "Maximum Flow and Water Consumption",
      es: "Flujo y Consumo Máximo de Agua",
    },
    codeSummary: {
      en: "Plumbing fixtures may not exceed the maximum flow rates in Table 604.4: lavatory faucets 2.2 gpm at 60 psi, showerheads 2.5 gpm at 80 psi, kitchen faucets 2.2 gpm, and water closets 1.6 gal per flush. Tested at the listed reference pressures.",
      es: "Los artefactos no pueden exceder los caudales máximos de la Tabla 604.4: grifos de lavabo 2.2 gpm a 60 psi, regaderas 2.5 gpm a 80 psi, grifos de cocina 2.2 gpm, e inodoros 1.6 gal por descarga. Se prueban a las presiones de referencia indicadas.",
    },
    plainEnglish: {
      en: "There are legal caps on how much water each fixture can use. Buy fixtures that meet these limits — most modern listed fixtures already do, and many beat them (e.g., 1.28 gpf WaterSense toilets).",
      es: "Hay límites legales sobre cuánta agua puede usar cada artefacto. Compra artefactos que cumplan estos límites; la mayoría de los modernos certificados ya lo hacen, y muchos los superan (p. ej., inodoros WaterSense de 1.28 gpf).",
    },
    fieldNotes: {
      en: "The flow restrictor in a showerhead is what keeps it compliant — pulling it out to boost pressure is a code violation. Spec WaterSense-labeled fixtures when the project chases green-building or utility-rebate credit.",
      es: "El restrictor de flujo de la regadera es lo que la mantiene en cumplimiento; quitarlo para aumentar la presión es una violación del código. Especifica artefactos con etiqueta WaterSense cuando el proyecto busque créditos de construcción verde o reembolsos de la empresa de agua.",
    },
    florida: {
      en: "Florida's water-management districts and many utilities offer rebates for high-efficiency fixtures, and several municipalities require WaterSense fixtures in new construction — check the local AHJ amendment before specifying.",
      es: "Los distritos de gestión de agua de Florida y muchas empresas de servicios ofrecen reembolsos por artefactos de alta eficiencia, y varios municipios exigen artefactos WaterSense en obra nueva: consulta la enmienda de la autoridad competente (AHJ) local antes de especificar.",
    },
  },
  {
    id: "605.3",
    section: "605.3",
    title: {
      en: "Water Service Pipe Materials",
      es: "Materiales de la Tubería de Servicio de Agua",
    },
    codeSummary: {
      en: "Water service pipe (from the public main or source to the building) must be one of the materials listed in Table 605.3 — including copper (Type K/L), CPVC, PEX, PE, and ductile iron — and rated for at least the maximum pressure, with a minimum 160 psi rating at 73.4°F where plastic is used underground.",
      es: "La tubería de servicio de agua (desde la red pública o la fuente hasta el edificio) debe ser uno de los materiales de la Tabla 605.3 —incluyendo cobre (Tipo K/L), CPVC, PEX, PE y hierro dúctil— y estar clasificada al menos para la presión máxima, con una clasificación mínima de 160 psi a 73.4°F cuando se use plástico bajo tierra.",
    },
    plainEnglish: {
      en: "Only certain approved pipe materials may carry potable water from the meter into the house. Match the material and its pressure rating to the job, and bury plastic pipe rated to handle the line pressure.",
      es: "Solo ciertos materiales aprobados pueden llevar agua potable desde el medidor hasta la casa. Ajusta el material y su clasificación de presión al trabajo, y entierra tubería plástica clasificada para soportar la presión de la línea.",
    },
    fieldNotes: {
      en: "Keep water service separated from the building sewer per FBC-P 603.2 (typically 5 ft horizontal, or in a trench with the water line on a 12 in shelf above the sewer). Track-wire or locatable tape over plastic service makes future locates possible.",
      es: "Mantén el servicio de agua separado del albañal del edificio según FBC-P 603.2 (típicamente 5 pies horizontales, o en una zanja con la línea de agua sobre una repisa 12 pulg por encima del albañal). El alambre trazador o cinta localizable sobre el servicio plástico permite ubicaciones futuras.",
    },
    florida: {
      en: "Florida's sandy, often corrosive and high-chloride soils favor PEX and CPVC over older galvanized; where copper is used in aggressive soil, sleeve it. Coastal jurisdictions may add backflow and corrosion requirements beyond the base code.",
      es: "Los suelos arenosos, a menudo corrosivos y con alto cloruro de Florida favorecen PEX y CPVC sobre el galvanizado antiguo; donde se use cobre en suelo agresivo, protégelo con camisa. Las jurisdicciones costeras pueden añadir requisitos de antirretorno y corrosión más allá del código base.",
    },
  },
  {
    id: "312.2",
    section: "312.2",
    title: {
      en: "Drainage and Vent Water Test",
      es: "Prueba de Agua del Drenaje y la Ventilación",
    },
    codeSummary: {
      en: "The DWV system must be tested with water by plugging all openings except the highest and filling the system with water to the top, holding for at least 15 minutes with no drop. Alternatively an air test of 5 psi (or 10 in mercury) held for 15 minutes is permitted.",
      es: "El sistema de drenaje y ventilación (DWV) debe probarse con agua tapando todas las aberturas excepto la más alta y llenándolo de agua hasta arriba, manteniéndolo al menos 15 minutos sin que baje el nivel. Alternativamente se permite una prueba de aire de 5 psi (o 10 pulg de mercurio) sostenida 15 minutos.",
    },
    plainEnglish: {
      en: "Before the walls close up, the inspector wants to see the drain/vent piping hold water (or air) without leaking for at least 15 minutes. No drop on the gauge means the joints are tight.",
      es: "Antes de cerrar las paredes, el inspector quiere ver que la tubería de drenaje/ventilación retenga agua (o aire) sin fugas durante al menos 15 minutos. Si el manómetro no baja, las uniones están herméticas.",
    },
    fieldNotes: {
      en: "Test before insulation and drywall — finding a leak after closeup is expensive. On tall stacks, water testing one floor at a time keeps the static head from over-stressing lower joints. Don't pressure-test plastic with air beyond what the AHJ allows.",
      es: "Prueba antes del aislamiento y el panel de yeso: encontrar una fuga después de cerrar es costoso. En columnas altas, probar con agua piso por piso evita que la carga estática sobreesfuerce las uniones inferiores. No pruebes plástico con aire más allá de lo que permita la autoridad competente (AHJ).",
    },
    florida: {
      en: "Many Florida jurisdictions require the water test specifically for the rough plumbing inspection on slab homes, since the under-slab DWV cannot be re-inspected after the pour. Schedule it before the slab is placed.",
      es: "Muchas jurisdicciones de Florida exigen específicamente la prueba de agua para la inspección de plomería en bruto en casas sobre losa, ya que el DWV bajo la losa no puede reinspeccionarse después del vaciado. Prográmala antes de colar la losa.",
    },
  },
];
