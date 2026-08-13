/** 五十音の「行」。さ行以降を足すときはここと CHARACTERS に追記するだけでよい。 */
export type Row = 'a' | 'ka' | 'omake';

export interface KanaEntry {
  /** 素材スプライトのマス番号 (1..11)。ファイル名の接頭辞でもある。 */
  id: number;
  /** 表に大きく出す文字。 */
  kana: string;
  /** ローマ字。ファイル名に使う。 */
  romaji: string;
  /** 音声が読み上げていることば。画面には出さず読み上げラベルにだけ使う。 */
  word: string;
  row: Row;
  /** 段 (あ=0, い=1, う=2, え=3, お=4)。「ん」は 0。 */
  col: number;
  /** 透過 PNG のパス。 */
  icon: string;
  /** ことばを読み上げる mp3 のパス。 */
  audio: string;
  /**
   * かな 1 音だけの mp3。今の素材には無い。
   * 後から用意したらここに足すだけでクイズが「か」→「かめ」の順で鳴るようになる。
   */
  kanaAudio?: string;
  /** クイズの出題対象か。「ん」は音声が「うんち」で噛み合わないので false。 */
  inQuiz: boolean;
}

const entry = (
  id: number,
  kana: string,
  romaji: string,
  word: string,
  row: Row,
  col: number,
  inQuiz = true,
): KanaEntry => ({
  id,
  kana,
  romaji,
  word,
  row,
  col,
  icon: `icons/${String(id).padStart(2, '0')}-${romaji}.png`,
  audio: `audio/${romaji === 'n' ? 'un' : romaji}.mp3`,
  inQuiz,
});

export const CHARACTERS: readonly KanaEntry[] = [
  entry(1, 'あ', 'a', 'あり', 'a', 0),
  entry(2, 'い', 'i', 'いぬ', 'a', 1),
  entry(3, 'う', 'u', 'うし', 'a', 2),
  entry(4, 'え', 'e', 'えんぴつ', 'a', 3),
  entry(5, 'お', 'o', 'おにぎり', 'a', 4),
  entry(6, 'か', 'ka', 'かめ', 'ka', 0),
  entry(7, 'き', 'ki', 'きりん', 'ka', 1),
  entry(8, 'く', 'ku', 'くるま', 'ka', 2),
  entry(9, 'け', 'ke', 'けいと', 'ka', 3),
  entry(10, 'こ', 'ko', 'こま', 'ka', 4),
  entry(11, 'ん', 'n', 'うんち', 'omake', 0, false),
];

/** おまけを除いた、表に列として並ぶ行。並び順は五十音表の右の列から。 */
export const KANA_ROWS: readonly Row[] = ['a', 'ka'];

/** クイズで出題できる文字。 */
export const QUIZ_POOL: readonly KanaEntry[] = CHARACTERS.filter((c) => c.inQuiz);

/** 1 セットの問題数。 */
export const QUIZ_SET_SIZE = 5;
