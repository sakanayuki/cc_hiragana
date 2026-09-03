/** 五十音の「行」。行を足すときはここと CHARACTERS、KANA_ROWS に追記する。 */
export type Row =
  | 'a'
  | 'ka'
  | 'sa'
  | 'ta'
  | 'na'
  | 'ha'
  | 'ma'
  | 'ya'
  | 'ra'
  | 'wa'
  | 'omake';

export interface KanaEntry {
  /** 五十音の並び順に振った通し番号。アイコンのファイル名の接頭辞でもある。 */
  id: number;
  /** 表に大きく出す文字。 */
  kana: string;
  /** ローマ字。アイコンと音声のファイル名に使う。 */
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
  /**
   * クイズの出題対象か。
   * 「ん」は音声が「うんち」、「を」は「えをかく」で、どちらも文字と音の頭が
   * そろわず子どもが混乱するため false にしている。
   */
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
  // 「ん」だけは音声が「うんち」なのでファイル名が un.mp3。
  // ふ は音声が hu.mp3 (訓令式) なので romaji 側を hu に合わせてある。
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
  entry(11, 'さ', 'sa', 'さる', 'sa', 0),
  entry(12, 'し', 'shi', 'しずく', 'sa', 1),
  entry(13, 'す', 'su', 'すいか', 'sa', 2),
  entry(14, 'せ', 'se', 'せみ', 'sa', 3),
  entry(15, 'そ', 'so', 'そうじき', 'sa', 4),
  entry(16, 'た', 'ta', 'たこ', 'ta', 0),
  entry(17, 'ち', 'chi', 'ちくわ', 'ta', 1),
  entry(18, 'つ', 'tsu', 'つみき', 'ta', 2),
  entry(19, 'て', 'te', 'てんとうむし', 'ta', 3),
  entry(20, 'と', 'to', 'とり', 'ta', 4),
  entry(21, 'な', 'na', 'なし', 'na', 0),
  entry(22, 'に', 'ni', 'にんじん', 'na', 1),
  entry(23, 'ぬ', 'nu', 'ぬりえ', 'na', 2),
  entry(24, 'ね', 'ne', 'ねこ', 'na', 3),
  entry(25, 'の', 'no', 'のり', 'na', 4),
  entry(26, 'は', 'ha', 'はさみ', 'ha', 0),
  entry(27, 'ひ', 'hi', 'ひこうき', 'ha', 1),
  entry(28, 'ふ', 'hu', 'ふね', 'ha', 2),
  entry(29, 'へ', 'he', 'へび', 'ha', 3),
  entry(30, 'ほ', 'ho', 'ほし', 'ha', 4),
  entry(31, 'ま', 'ma', 'まくら', 'ma', 0),
  entry(32, 'み', 'mi', 'みみ', 'ma', 1),
  entry(33, 'む', 'mu', 'むしめがね', 'ma', 2),
  entry(34, 'め', 'me', 'めがね', 'ma', 3),
  entry(35, 'も', 'mo', 'もも', 'ma', 4),
  entry(36, 'や', 'ya', 'やかん', 'ya', 0),
  entry(37, 'ゆ', 'yu', 'ゆびわ', 'ya', 2),
  entry(38, 'よ', 'yo', 'ようふく', 'ya', 4),
  entry(39, 'ら', 'ra', 'らいおん', 'ra', 0),
  entry(40, 'り', 'ri', 'りす', 'ra', 1),
  entry(41, 'る', 'ru', 'るすばん', 'ra', 2),
  entry(42, 'れ', 're', 'れもん', 'ra', 3),
  entry(43, 'ろ', 'ro', 'ろうそく', 'ra', 4),
  entry(44, 'わ', 'wa', 'わに', 'wa', 0),
  entry(45, 'を', 'wo', 'えをかく', 'wa', 4, false),
  entry(46, 'ん', 'n', 'うんち', 'omake', 0, false),
];

/** おまけを除いた、表に列として並ぶ行。並び順は五十音表の右の列から。 */
export const KANA_ROWS: readonly Row[] = [
  'a',
  'ka',
  'sa',
  'ta',
  'na',
  'ha',
  'ma',
  'ya',
  'ra',
  'wa',
];

/** クイズで出題できる文字。 */
export const QUIZ_POOL: readonly KanaEntry[] = CHARACTERS.filter((c) => c.inQuiz);

/** 1 セットの問題数。 */
export const QUIZ_SET_SIZE = 5;
