import { avatarChoices } from "./avatar.js";

type Choices = typeof avatarChoices;

/**
 * Russian names for every avataaars option, keyed by the library's own values.
 *
 * These live here rather than in the app's message dictionary on purpose: they are
 * a closed set derived from a third-party enum, and the `Record<Choices[K][number]>`
 * type below makes the compiler reject the file the moment a choice gains a value
 * with no translation. A flat key/string dictionary could not check that.
 */
type OptionLabels = { [K in keyof Choices]: Record<Choices[K][number], string> };

/** The name of each control in the editor. */
export const fieldLabels: Record<keyof Choices, string> = {
  topType: "Причёска / головной убор",
  accessoriesType: "Аксессуары",
  hatColor: "Цвет головного убора",
  hairColor: "Цвет волос",
  facialHairType: "Растительность на лице",
  facialHairColor: "Цвет растительности",
  clotheType: "Одежда",
  clotheColor: "Цвет одежды",
  graphicType: "Рисунок на одежде",
  eyeType: "Глаза",
  eyebrowType: "Брови",
  mouthType: "Рот",
  skinColor: "Цвет кожи",
};

const COLOURS = {
  Black: "Чёрный",
  Blue01: "Синий",
  Blue02: "Синий, тёмный",
  Blue03: "Синий, глубокий",
  Gray01: "Серый",
  Gray02: "Серый, тёмный",
  Heather: "Меланж",
  PastelBlue: "Пастельный голубой",
  PastelGreen: "Пастельный зелёный",
  PastelOrange: "Пастельный оранжевый",
  PastelRed: "Пастельный красный",
  PastelYellow: "Пастельный жёлтый",
  Pink: "Розовый",
  Red: "Красный",
  White: "Белый",
} as const;

const HAIR_COLOURS = {
  Auburn: "Каштановый",
  Black: "Чёрный",
  Blonde: "Блонд",
  BlondeGolden: "Золотистый блонд",
  Brown: "Русый",
  BrownDark: "Тёмно-русый",
  Platinum: "Платиновый",
  Red: "Рыжий",
} as const;

export const optionLabels: OptionLabels = {
  topType: {
    NoHair: "Без волос",
    Eyepatch: "Повязка на глаз",
    Hat: "Шляпа",
    Hijab: "Хиджаб",
    Turban: "Тюрбан",
    WinterHat1: "Зимняя шапка",
    WinterHat2: "Зимняя шапка с помпоном",
    WinterHat3: "Шапка с ушами",
    WinterHat4: "Вязаная шапка",
    LongHairBigHair: "Длинные, пышные",
    LongHairBob: "Длинные, каре",
    LongHairBun: "Длинные, пучок",
    LongHairCurly: "Длинные, кудрявые",
    LongHairCurvy: "Длинные, волнистые",
    LongHairDreads: "Длинные, дреды",
    LongHairFrida: "Длинные, как у Фриды",
    LongHairFro: "Длинные, афро",
    LongHairFroBand: "Длинные, афро с повязкой",
    LongHairMiaWallace: "Длинные, как у Мии Уоллес",
    LongHairNotTooLong: "Длинные, до плеч",
    LongHairShavedSides: "Длинные, с выбритыми висками",
    LongHairStraight: "Длинные, прямые",
    LongHairStraight2: "Длинные, прямые с пробором",
    LongHairStraightStrand: "Длинные, прямые с прядью",
    ShortHairDreads01: "Короткие, дреды",
    ShortHairDreads02: "Короткие, дреды с пробором",
    ShortHairFrizzle: "Короткие, курчавые",
    ShortHairShaggy: "Короткие, лохматые",
    ShortHairShaggyMullet: "Короткие, маллет",
    ShortHairShortCurly: "Короткие, кудрявые",
    ShortHairShortFlat: "Короткие, гладкие",
    ShortHairShortRound: "Короткие, круглые",
    ShortHairShortWaved: "Короткие, волнистые",
    ShortHairSides: "Короткие, только по бокам",
    ShortHairTheCaesar: "Короткие, «Цезарь»",
    ShortHairTheCaesarSidePart: "Короткие, «Цезарь» с пробором",
  },
  accessoriesType: {
    Blank: "Без аксессуаров",
    Kurt: "Очки в тонкой оправе",
    Prescription01: "Очки для зрения, овальные",
    Prescription02: "Очки для зрения, прямоугольные",
    Round: "Круглые очки",
    Sunglasses: "Солнцезащитные очки",
    Wayfarers: "Очки-вайфареры",
  },
  hatColor: COLOURS,
  hairColor: {
    ...HAIR_COLOURS,
    PastelPink: "Пастельный розовый",
    Blue: "Синий",
    SilverGray: "Серебристо-седой",
  },
  facialHairType: {
    Blank: "Без растительности",
    BeardMedium: "Борода средней длины",
    BeardLight: "Лёгкая щетина",
    BeardMajestic: "Окладистая борода",
    MoustacheFancy: "Усы с завитками",
    MoustacheMagnum: "Густые усы",
  },
  facialHairColor: HAIR_COLOURS,
  clotheType: {
    BlazerShirt: "Пиджак и рубашка",
    BlazerSweater: "Пиджак и свитер",
    CollarSweater: "Свитер с воротником",
    GraphicShirt: "Футболка с рисунком",
    Hoodie: "Худи",
    Overall: "Комбинезон",
    ShirtCrewNeck: "Футболка с круглым вырезом",
    ShirtScoopNeck: "Футболка с глубоким вырезом",
    ShirtVNeck: "Футболка с V-образным вырезом",
  },
  clotheColor: COLOURS,
  graphicType: {
    Bat: "Летучая мышь",
    Cumbia: "Кумбия",
    Deer: "Олень",
    Diamond: "Ромб",
    Hola: "Надпись «Hola»",
    Pizza: "Пицца",
    Resist: "Надпись «Resist»",
    Selena: "Селена",
    Bear: "Медведь",
    SkullOutline: "Череп, контур",
    Skull: "Череп",
  },
  eyeType: {
    Close: "Закрытые",
    Cry: "Со слезой",
    Default: "Обычные",
    Dizzy: "Крестики",
    EyeRoll: "Закатившиеся",
    Happy: "Довольные",
    Hearts: "Сердечки",
    Side: "Взгляд вбок",
    Squint: "Прищур",
    Surprised: "Удивлённые",
    Wink: "Подмигивает",
    WinkWacky: "Дурашливо подмигивает",
  },
  eyebrowType: {
    Angry: "Сердитые",
    AngryNatural: "Сердитые, густые",
    Default: "Обычные",
    DefaultNatural: "Обычные, густые",
    FlatNatural: "Прямые, густые",
    FrownNatural: "Нахмуренные, густые",
    RaisedExcited: "Приподнятые",
    RaisedExcitedNatural: "Приподнятые, густые",
    SadConcerned: "Печальные",
    SadConcernedNatural: "Печальные, густые",
    UnibrowNatural: "Сросшиеся",
    UpDown: "Одна выше другой",
    UpDownNatural: "Одна выше другой, густые",
  },
  mouthType: {
    Concerned: "Обеспокоенный",
    Default: "Обычный",
    Disbelief: "Недоверие",
    Eating: "Жуёт",
    Grimace: "Гримаса",
    Sad: "Грустный",
    ScreamOpen: "Кричит",
    Serious: "Серьёзный",
    Smile: "Улыбка",
    Tongue: "Показывает язык",
    Twinkle: "Ухмылка",
    Vomit: "Тошнит",
  },
  skinColor: {
    Tanned: "Загорелый",
    Yellow: "Жёлтый",
    Pale: "Очень светлый",
    Light: "Светлый",
    Brown: "Смуглый",
    DarkBrown: "Тёмно-смуглый",
    Black: "Тёмный",
  },
};

/** Falls back to the library's own value, so an untranslated option still reads. */
export function optionLabel(field: keyof Choices, option: string): string {
  return (optionLabels[field] as Record<string, string>)[option] ?? option;
}
