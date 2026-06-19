const isoCube = (w: number, h: number, d: number) => {
  const w2 = w / 2, h2 = h / 2, d2 = d / 2
  return [
    `M50 ${50-h2} L${50+w2} ${50-h2+d2/2} L50 ${50-h2+d2} L${50-w2} ${50-h2+d2/2} Z`,
    `M${50-w2} ${50-h2+d2/2} L${50-w2} ${50+h2-d2/2} L50 ${50+h2} L50 ${50-h2+d2} Z`,
    `M50 ${50-h2+d2} L50 ${50+h2} L${50+w2} ${50+h2-d2/2} L${50+w2} ${50-h2+d2/2} Z`
  ]
}

const isoBox = isoCube(70, 70, 70)
const isoTall = isoCube(60, 90, 60)
const isoWide = isoCube(90, 50, 60)
const isoFlat = isoCube(85, 30, 85)
const isoRound = [
  `M50 15 Q75 20 85 50 Q80 80 50 85 Q20 80 15 50 Q20 20 50 15 Z`,
  `M50 25 Q70 28 78 50 Q74 72 50 75 Q26 72 22 50 Q26 28 50 25 Z`,
  `M50 35 Q63 37 68 50 Q65 63 50 65 Q35 63 32 50 Q35 37 50 35 Z`
]
const isoSofa = [
  `M25 55 L25 75 L75 75 L75 55 L70 50 L70 45 L60 40 L60 35 L40 35 L40 40 L30 45 L30 50 Z`,
  `M28 58 L28 70 L72 70 L72 58 L68 52 L32 52 Z`,
  `M35 38 L45 36 L55 36 L65 38 L65 45 L35 45 Z`
]
const isoBed = [
  `M15 60 L15 78 L85 78 L85 60 L80 55 L80 45 L20 45 L20 55 Z`,
  `M18 62 L18 75 L82 75 L82 62 L78 56 L22 56 Z`,
  `M20 46 L40 42 L60 42 L80 46 L80 50 L20 50 Z`
]
const isoTable = [
  `M20 45 L80 45 L75 50 L25 50 Z`,
  `M22 50 L26 82 M74 50 L78 82 M30 50 L33 75 M67 50 L70 75`,
  `M20 42 Q20 40 25 38 L75 38 Q80 40 80 42 L80 45 L20 45 Z`
]
const isoChair = [
  `M30 45 L70 45 L65 50 L35 50 Z`,
  `M35 50 L32 78 L40 78 L42 52 M58 52 L60 78 L68 78 L65 50`,
  `M30 20 L70 20 L70 45 L30 45 Z`
]
const isoCabinet = [
  `M25 15 L75 15 L78 18 L78 85 L22 85 L22 18 Z`,
  `M28 20 L72 20 L72 80 L28 80 Z`,
  `M28 20 L72 20 L72 50 L28 50 Z M28 52 L72 52 L72 80 L28 80 Z`
]
const isoTV = [
  `M20 35 L80 35 L80 70 L20 70 Z`,
  `M24 39 L76 39 L76 66 L24 66 Z`,
  `M45 72 L55 72 L55 82 L45 82 Z M40 82 L60 82`
]
const isoToilet = [
  `M35 35 L65 35 L68 40 L68 80 L62 85 L38 85 L32 80 L32 40 Z`,
  `M38 38 L62 38 L65 42 L65 50 L35 50 L35 42 Z`,
  `M40 52 L60 52 L60 72 L40 72 Z`
]
const isoSink = [
  `M20 40 L80 40 L80 48 L20 48 Z`,
  `M25 50 L75 50 L75 75 L25 75 Z`,
  `M35 44 Q50 40 65 44 Q65 48 50 50 Q35 48 35 44 Z`
]
const isoBath = [
  `M15 45 L85 45 L85 75 L15 75 Z`,
  `M18 48 L82 48 L82 70 L18 70 Z`,
  `M25 52 Q50 48 75 52 Q75 66 50 68 Q25 66 25 52 Z`
]
const isoStove = [
  `M20 35 L80 35 L80 85 L20 85 Z`,
  `M23 38 L77 38 L77 48 L23 48 Z`,
  `M30 40 C30 37 38 37 38 40 C38 43 30 43 30 40 Z M62 40 C62 37 70 37 70 40 C70 43 62 43 62 40 Z M46 40 C46 37 54 37 54 40 C54 43 46 43 46 40 Z M38 44 C38 41 46 41 46 44 C46 47 38 47 38 44 Z M54 44 C54 41 62 41 62 44 C62 47 54 47 54 44 Z`
]
const isoFridge = [
  `M28 12 L72 12 L76 16 L76 88 L24 88 L24 16 Z`,
  `M30 18 L70 18 L70 50 L30 50 Z M30 52 L70 52 L70 85 L30 85 Z`,
  `M65 30 L65 40 L65 35 Z M65 62 L65 72 L65 67 Z`
]
const isoWashing = [
  `M25 15 L75 15 L78 18 L78 85 L22 85 L22 18 Z`,
  `M28 20 L72 20 L72 40 L28 40 Z`,
  `M50 55 C50 40 38 40 38 55 C38 70 50 70 50 55 Z M62 55 C62 40 74 40 74 55 C74 70 62 70 62 55 Z`
]
const isoPlant = [
  `M35 60 L65 60 L62 85 L38 85 Z`,
  `M50 58 C40 55 30 45 35 30 C40 35 48 40 50 30 C52 40 60 35 65 30 C70 45 60 55 50 58 Z`,
  `M50 10 C42 18 35 25 42 35 C50 30 50 25 50 10 C50 25 50 30 58 35 C65 25 58 18 50 10 Z`
]
const isoLamp = [
  `M45 18 L55 18 L58 22 L58 35 L42 35 L42 22 Z`,
  `M50 35 L47 75 L53 75 Z`,
  `M35 75 L65 75 L62 82 L38 82 Z`
]
const isoBook = [
  `M25 40 L75 40 L75 48 L25 48 Z`,
  `M28 42 L30 45 L33 42 L36 45 L39 42 L42 45 L45 42 L48 45 L51 42 L54 45 L57 42 L60 45 L63 42 L66 45 L69 42 L72 45 Z`,
  `M25 48 L75 48 L72 80 L28 80 Z`
]
const isoDesk = [
  `M15 40 L85 40 L82 45 L18 45 Z`,
  `M20 45 L25 85 L30 85 L32 48 M68 48 L70 85 L75 85 L80 45`,
  `M15 38 Q15 36 20 34 L80 34 Q85 36 85 38 L85 40 L15 40 Z`
]
const isoOven = [
  `M25 15 L75 15 L78 18 L78 85 L22 85 L22 18 Z`,
  `M28 20 L72 20 L72 30 L28 30 Z M28 35 L72 35 L72 80 L28 80 Z`,
  `M35 45 C35 60 65 60 65 45 C65 30 35 30 35 45 Z M68 22 L72 22 M68 25 L72 25`
]
const isoDoor = [
  `M28 10 L72 10 L75 13 L75 90 L25 90 L25 13 Z`,
  `M30 15 L70 15 L70 85 L30 85 Z`,
  `M65 50 C65 48 68 48 68 50 C68 52 65 52 65 50 Z`
]
const isoWindow = [
  `M18 20 L82 20 L82 80 L18 80 Z`,
  `M22 24 L78 24 L78 76 L22 76 Z`,
  `M50 24 L50 76 M22 50 L78 50`
]
const isoStair = [
  `M20 80 L20 75 L30 75 L30 70 L40 70 L40 65 L50 65 L50 60 L60 60 L60 55 L70 55 L70 50 L80 50 L80 45 L85 45 L85 80 Z`,
  `M20 80 L85 80 L85 76 L20 76 Z`,
  `M22 73 L28 73 L28 70 L22 70 Z M32 68 L38 68 L38 65 L32 65 Z M42 63 L48 63 L48 60 L42 60 Z M52 58 L58 58 L58 55 L52 55 Z M62 53 L68 53 L68 50 L62 50 Z M72 48 L78 48 L78 45 L72 45 Z`
]
const isoTreadmill = [
  `M15 55 L85 55 L88 60 L88 80 L12 80 L12 60 Z`,
  `M18 62 L82 62 L82 72 L18 72 Z`,
  `M70 15 L80 15 L80 55 L70 55 Z M72 20 L78 20 L78 45 L72 45 Z`
]
const isoProjector = [
  `M20 45 L80 45 L85 50 L85 70 L80 75 L20 75 L15 70 L15 50 Z`,
  `M22 48 L78 48 L78 68 L22 68 Z`,
  `M30 55 Q50 52 70 55 Q70 62 50 64 Q30 62 30 55 Z`
]
const isoSpeaker = [
  `M30 15 L70 15 L75 20 L75 85 L25 85 L25 20 Z`,
  `M32 22 L68 22 L68 80 L32 80 Z`,
  `M50 40 C50 30 40 30 40 40 C40 50 50 50 50 40 C50 30 60 30 60 40 C60 50 50 50 50 40 Z M50 65 C50 55 40 55 40 65 C40 75 50 75 50 65 C50 55 60 55 60 65 C60 75 50 75 50 65 Z`
]
const isoCarpet = [
  `M15 55 L85 55 L88 60 L88 80 L12 80 L12 60 Z`,
  `M18 57 L82 57 L82 78 L18 78 Z`,
  `M30 62 L35 62 L35 75 L30 75 Z M45 62 L50 62 L50 75 L45 75 Z M60 62 L65 62 L65 75 L60 75 Z M25 67 L75 67 L75 70 L25 70 Z`
]
const isoPainting = [
  `M25 25 L75 25 L78 28 L78 72 L75 75 L25 75 L22 72 L22 28 Z`,
  `M28 30 L72 30 L72 70 L28 70 Z`,
  `M35 40 L50 35 L65 45 L50 55 L35 50 Z M40 55 L55 50 L60 60 L45 65 Z`
]
const isoDish = [
  `M25 40 L75 40 L80 50 L80 58 L75 65 L25 65 L20 58 L20 50 Z`,
  `M25 42 L75 42 L78 50 L22 50 Z`,
  `M30 52 Q50 48 70 52 Q70 62 50 62 Q30 62 30 52 Z`
]
const isoCup = [
  `M35 30 L65 30 L68 40 L68 70 L62 80 L38 80 L32 70 L32 40 Z`,
  `M35 33 L65 33 L65 70 L35 70 Z`,
  `M68 50 C75 48 78 55 75 62 C72 68 68 66 68 58 Z`
]

export const isometricIcons: Record<string, string[]> = {
  'sofa': isoSofa,
  'bed': isoBed,
  'table': isoTable,
  'chair': isoChair,
  'cabinet': isoCabinet,
  'cupboard': isoCabinet,
  'wardrobe': isoTall,
  'tv': isoTV,
  'toilet': isoToilet,
  'sink': isoSink,
  'bath': isoBath,
  'stove': isoStove,
  'fridge': isoFridge,
  'washing': isoWashing,
  'plant': isoPlant,
  'lamp': isoLamp,
  'book': isoBook,
  'desk': isoDesk,
  'oven': isoOven,
  'door': isoDoor,
  'window': isoWindow,
  'stair': isoStair,
  'treadmill': isoTreadmill,
  'projector': isoProjector,
  'speaker': isoSpeaker,
  'carpet': isoCarpet,
  'painting': isoPainting,
  'dish': isoDish,
  'cup': isoCup,
  'box': isoBox,
  'cube': isoCube,
  'tall': isoTall,
  'wide': isoWide,
  'flat': isoFlat,
  'round': isoRound,
  '🛋️': isoSofa,
  '🪑': isoChair,
  '🛏️': isoBed,
  '🚪': isoDoor,
  '🪟': isoWindow,
  '📺': isoTV,
  '💡': isoLamp,
  '🪴': isoPlant,
  '🖼️': isoPainting,
  '🟥': isoCarpet,
  '🟦': isoRound,
  '🟪': isoCarpet,
  '🟧': isoCarpet,
  '🟨': isoCarpet,
  '🔘': isoRound,
  '🔲': isoBox,
  '🔴': isoRound,
  '🗄️': isoCabinet,
  '📦': isoBox,
  '🚽': isoToilet,
  '🚰': isoSink,
  '🛁': isoBath,
  '🚿': isoBath,
  '🔥': isoStove,
  '💨': isoWide,
  '🧼': isoCup,
  '🧊': isoFridge,
  '📻': isoBox,
  '🧴': isoCup,
  '💧': isoFlat,
  '🍹': isoCup,
  '🍽️': isoDish,
  '🍷': isoCup,
  '📚': isoBook,
  '💻': isoFlat,
  '📊': isoDesk,
  '📁': isoBook,
  '👔': isoTall,
  '👟': isoBox,
  '👕': isoTall,
  '🧸': isoRound,
  '💍': isoRound,
  '👜': isoBox,
  '💄': isoTall,
  '🎬': isoProjector,
  '📽️': isoProjector,
  '🔊': isoSpeaker,
  '🎛️': isoOven,
  '🔇': isoBox,
  '✨': isoRound,
  '🏃': isoTreadmill,
  '🚴': isoTreadmill,
  '💪': isoTall,
  '🏋️': isoBox,
  '🧘': isoFlat,
  '🪞': isoWindow,
  '🏢': isoTall,
  '💼': isoBox,
  '📋': isoBook,
  '☕': isoCup,
  '🖨️': isoBox,
  '🏠': isoTall,
  '📐': isoWide,
  '🧲': isoRound,
  '📏': isoWide,
  '↩️': isoFlat,
  '↪️': isoFlat,
  '📂': isoBook,
  '💾': isoBox,
  '🖼️ ': isoPainting,
  '👆': isoBox,
  '〰️': isoFlat,
  '🎢': isoRound,
  '📝': isoBook,
  '🧺': isoBox,
  '🧻': isoRound,
  '🌞': isoRound,
  '💼 ': isoBox,
  '🍳': isoRound,
  '🧥': isoTall,
  '🛋️ ': isoSofa,
  '🔵': isoRound,
  '👗': isoCabinet,
  'glass-cabinet': isoCabinet,
  'ball': isoRound,
  'round-table': isoRound
}
