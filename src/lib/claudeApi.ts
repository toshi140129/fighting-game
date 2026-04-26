import type { CharacterPersonality, Move, GamblingMove } from "../types/game";

const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `あなたは格闘ゲームの必殺技デザイナーです。
ユーザーが入力した「特徴・得意なこと・職業」をもとに
オリジナル必殺技を3つと賭け技を1つ生成してください。

出力はJSON形式のみで返してください：
{
  "moves": [
    {
      "name": "技名",
      "description": "技の説明（20文字以内）",
      "animation_hint": "技のビジュアルイメージ（例：前方に突進して噛みつく）",
      "type": "melee" | "ranged" | "area",
      "flavor_text": "技を出すときの掛け声（10文字以内）"
    }
  ],
  "gambling_move": {
    "name": "賭け技名",
    "description": "技の説明（20文字以内）",
    "flavor_text": "掛け声（10文字以内）",
    "animation_hint": "ビジュアルイメージ"
  }
}

ルール：
- 身体的特徴は本人が自分で入力したものなので面白くかっこよく技に昇華させる
- 職業・趣味は道具・動作・専門知識を技に組み込む
- 技名は中二病感があるほど良い
- 3つの技は必ずmelee/ranged/areaを1つずつにする
- JSONのみ返すこと`;

export interface GeneratedMoveData {
  moves: Array<{
    name: string;
    description: string;
    animation_hint: string;
    type: "melee" | "ranged" | "area";
    flavor_text: string;
  }>;
  gambling_move: {
    name: string;
    description: string;
    flavor_text: string;
    animation_hint: string;
  };
}

const getApiKey = (): string => {
  return import.meta.env.VITE_ANTHROPIC_API_KEY ?? "";
};

const buildUserPrompt = (personality: CharacterPersonality): string => {
  return `特徴・外見：${personality.appearance || "(未入力)"}
得意なこと・趣味：${personality.hobby || "(未入力)"}
職業・肩書：${personality.job || "(未入力)"}

上記の人物に最高にかっこいい必殺技を3つと賭け技を1つ作ってください。`;
};

export const generateSpecialMoves = async (
  personality: CharacterPersonality
): Promise<GeneratedMoveData> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return generateFallbackMoves(personality);
  }

  try {
    const response = await fetch(ANTHROPIC_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(personality) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSONが見つかりません");
    }
    const parsed = JSON.parse(jsonMatch[0]) as GeneratedMoveData;
    if (!parsed.moves || parsed.moves.length < 3 || !parsed.gambling_move) {
      throw new Error("不正な形式");
    }
    return parsed;
  } catch (e) {
    console.warn("Claude API失敗、フォールバックを使用:", e);
    return generateFallbackMoves(personality);
  }
};

const generateFallbackMoves = (
  personality: CharacterPersonality
): GeneratedMoveData => {
  const traits = [
    personality.appearance,
    personality.hobby,
    personality.job,
  ].filter(Boolean);
  const seed = traits.join("/") || "戦士";
  return {
    moves: [
      {
        name: `${seed}・烈拳`,
        description: "渾身の一撃を叩き込む",
        animation_hint: "前方に突進して殴る",
        type: "melee",
        flavor_text: "うおおおっ！",
      },
      {
        name: `${seed}・閃光弾`,
        description: "気の弾を放つ",
        animation_hint: "光弾を撃ち出す",
        type: "ranged",
        flavor_text: "撃てぇっ！",
      },
      {
        name: `${seed}・嵐衝波`,
        description: "周囲に衝撃を放つ",
        animation_hint: "全方位に衝撃波",
        type: "area",
        flavor_text: "弾けろ！",
      },
    ],
    gambling_move: {
      name: `${seed}・運命の刃`,
      description: "全てを賭けた一撃",
      flavor_text: "賭けるッ！",
      animation_hint: "オーラを纏い突撃",
    },
  };
};

export const buildMovesFromGenerated = (
  generated: GeneratedMoveData,
  pointAllocations: number[],
  customNames: string[] = []
): Move[] => {
  return generated.moves.slice(0, 3).map((m, i) => {
    const points = pointAllocations[i] ?? 20;
    const power = 15 + Math.round(points * 0.6);
    const cooldown = Math.max(2, 12 - points * 0.1);
    const range = m.type === "ranged" ? "long" : "short";
    const finalPower = range === "long" ? Math.round(power * 0.9) : power;
    return {
      id: `move${i + 1}`,
      name: customNames[i] || m.name,
      description: m.description,
      animation_hint: m.animation_hint,
      type: m.type,
      flavor_text: m.flavor_text,
      power: finalPower,
      cooldown,
      range,
      pointsAllocated: points,
    };
  });
};

export const buildGamblingMoveFromGenerated = (
  generated: GeneratedMoveData,
  basePoints: number,
  selfReductionPoints: number,
  customName?: string
): GamblingMove => {
  return {
    name: customName || generated.gambling_move.name,
    description: generated.gambling_move.description,
    flavor_text: generated.gambling_move.flavor_text,
    animation_hint: generated.gambling_move.animation_hint,
    basePower: 20 + basePoints * 1.2,
    selfDamageReduction: selfReductionPoints * 0.05,
  };
};

export const generateBattleCommentary = async (
  winnerName: string,
  loserName: string,
  winnerHp: number,
  isDraw: boolean
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    if (isDraw) return `${winnerName} と ${loserName}、激戦の末ドロー！両者見事な戦いだった！`;
    return `${winnerName} の勝利！残りHP${winnerHp}での激闘を制した！`;
  }

  try {
    const response = await fetch(ANTHROPIC_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: isDraw
              ? `格闘ゲームの実況者として、${winnerName} と ${loserName} の死闘がドローに終わった試合を1〜2文で熱く実況してください。`
              : `格闘ゲームの実況者として、${winnerName} が ${loserName} を倒した試合を1〜2文で熱く実況してください。勝者の残りHPは${winnerHp}。`,
          },
        ],
      }),
    });
    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    return data.content?.[0]?.text ?? `${winnerName} の勝利！`;
  } catch {
    if (isDraw) return `${winnerName} と ${loserName}、激戦の末ドロー！`;
    return `${winnerName} の勝利！`;
  }
};
