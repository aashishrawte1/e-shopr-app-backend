export function canAddOperator(sql: string) {
	sql = sql.trim().toLowerCase();
	const index = sql.lastIndexOf('where');
	if (index === -1) {
		return false;
	}
	const lastWord = sql.substring(index).trim();
	if (lastWord === 'where') {
		return false;
	}

	const lastChar = sql.charAt(sql.length - 1);
	if (lastChar === '(') {
		return false;
	}

	return true;
}
