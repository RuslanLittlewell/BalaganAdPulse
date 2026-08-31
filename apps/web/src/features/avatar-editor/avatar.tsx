import Avatar from "avataaars";
import { AVATAR_PX } from "@/shared/lib/index.js";
import React17 from "react17";
import { renderToStaticMarkup } from "react-dom17/server";

export const avatarChoices = {
  topType: ["NoHair", "Eyepatch", "Hat", "Hijab", "Turban", "WinterHat1", "WinterHat2", "WinterHat3", "WinterHat4", "LongHairBigHair", "LongHairBob", "LongHairBun", "LongHairCurly", "LongHairCurvy", "LongHairDreads", "LongHairFrida", "LongHairFro", "LongHairFroBand", "LongHairMiaWallace", "LongHairNotTooLong", "LongHairShavedSides", "LongHairStraight", "LongHairStraight2", "LongHairStraightStrand", "ShortHairDreads01", "ShortHairDreads02", "ShortHairFrizzle", "ShortHairShaggy", "ShortHairShaggyMullet", "ShortHairShortCurly", "ShortHairShortFlat", "ShortHairShortRound", "ShortHairShortWaved", "ShortHairSides", "ShortHairTheCaesar", "ShortHairTheCaesarSidePart"],
  accessoriesType: ["Blank", "Kurt", "Prescription01", "Prescription02", "Round", "Sunglasses", "Wayfarers"],
  hatColor: ["Black", "Blue01", "Blue02", "Blue03", "Gray01", "Gray02", "Heather", "PastelBlue", "PastelGreen", "PastelOrange", "PastelRed", "PastelYellow", "Pink", "Red", "White"],
  hairColor: ["Auburn", "Black", "Blonde", "BlondeGolden", "Brown", "BrownDark", "PastelPink", "Blue", "Platinum", "Red", "SilverGray"],
  facialHairType: ["Blank", "BeardMedium", "BeardLight", "BeardMajestic", "MoustacheFancy", "MoustacheMagnum"],
  facialHairColor: ["Auburn", "Black", "Blonde", "BlondeGolden", "Brown", "BrownDark", "Platinum", "Red"],
  clotheType: ["BlazerShirt", "BlazerSweater", "CollarSweater", "GraphicShirt", "Hoodie", "Overall", "ShirtCrewNeck", "ShirtScoopNeck", "ShirtVNeck"],
  clotheColor: ["Black", "Blue01", "Blue02", "Blue03", "Gray01", "Gray02", "Heather", "PastelBlue", "PastelGreen", "PastelOrange", "PastelRed", "PastelYellow", "Pink", "Red", "White"],
  graphicType: ["Bat", "Cumbia", "Deer", "Diamond", "Hola", "Pizza", "Resist", "Selena", "Bear", "SkullOutline", "Skull"],
  eyeType: ["Close", "Cry", "Default", "Dizzy", "EyeRoll", "Happy", "Hearts", "Side", "Squint", "Surprised", "Wink", "WinkWacky"],
  eyebrowType: ["Angry", "AngryNatural", "Default", "DefaultNatural", "FlatNatural", "FrownNatural", "RaisedExcited", "RaisedExcitedNatural", "SadConcerned", "SadConcernedNatural", "UnibrowNatural", "UpDown", "UpDownNatural"],
  mouthType: ["Concerned", "Default", "Disbelief", "Eating", "Grimace", "Sad", "ScreamOpen", "Serious", "Smile", "Tongue", "Twinkle", "Vomit"],
  skinColor: ["Tanned", "Yellow", "Pale", "Light", "Brown", "DarkBrown", "Black"],
} as const;

function pick(values: string[]) {
  return values[Math.floor(Math.random() * values.length)];
}

export type AvatarOptions = { -readonly [K in keyof typeof avatarChoices]: string };

export function randomAvatarOptions(): AvatarOptions {
  return Object.fromEntries(Object.entries(avatarChoices).map(([key, values]) => [key, pick([...values])])) as AvatarOptions;
}

export function parseAvatarPath(path: string | null): AvatarOptions {
  if (!path) return randomAvatarOptions();
  try {
    const parsed = JSON.parse(path) as Partial<AvatarOptions>;
    const fallback = randomAvatarOptions();
    for (const key of Object.keys(avatarChoices) as (keyof AvatarOptions)[]) {
      if (!avatarChoices[key].includes(parsed[key] as never)) parsed[key] = fallback[key];
    }
    return parsed as AvatarOptions;
  } catch { return randomAvatarOptions(); }
}

function avatarSvg(options: AvatarOptions) {
  return renderToStaticMarkup(React17.createElement(Avatar as never, {
    avatarStyle: "Circle",
    ...options,
  }));
}

export function AvatarPreview({ options }: { options: AvatarOptions }) {
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg(options))}`;
  return <img src={source} alt="Предпросмотр аватара" />;
}

export async function avatarPng(options: AvatarOptions): Promise<Blob> {
  const svg = avatarSvg(options);
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_PX;
    canvas.height = AVATAR_PX;
    canvas.getContext("2d")?.drawImage(image, 0, 0, AVATAR_PX, AVATAR_PX);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось создать PNG")), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(source);
  }
}
