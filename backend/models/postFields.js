// 선택 편집 필드. 기존 문서는 값을 생성하거나 이동하지 않는다.
const postFields = {
  yearStart: String,
  yearEnd: String,
  status: { type: String, enum: ['done', 'ongoing', 'unknown'] },
  venue: String,
  city: String,
  medium: String,
  summary: String,
  lede: String,
  artistNote: { type: { text: String, by: String, _id: false }, default: undefined },
  quote: { type: { text: String, author: String, title: String, source: String, year: String, excerpt: Boolean, _id: false }, default: undefined },
  credits: { type: [{ k: String, v: String, _id: false }], default: undefined },
  audience: String,
  partners: { type: [{ name: String, role: String, _id: false }], default: undefined },
};

// 허용 필드만 복사. PUT 생략 필드는 보존하고 빈 값은 명시적인 지우기로 받는다.
const pickPostFields = (source) => Object.fromEntries(
  Object.keys(postFields).filter((key) => source[key] !== undefined).map((key) => [key, source[key]])
);
module.exports = { postFields, pickPostFields };
