/**
 * 영문 구간만 Title Case(첫 글자 대문자·나머지 소문자)로 맞춘다.
 * 한글·숫자·기호는 그대로 둔다. (예: "ABHISHEK V" → "Abhishek V", "김대성" → "김대성")
 */
export function formatPersonDisplayName(raw: string): string {
  const name = raw.trim();
  if (!name) return name;
  return name.replace(/[A-Za-z]+/g, (word) => {
    if (word.length === 1) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}
