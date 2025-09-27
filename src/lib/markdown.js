const screenshotToken = (path) => `[[IMG:${path}]]`;

const escapeHtml = (str = '') =>
	str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const escapeAttribute = (str = '') => escapeHtml(str).replace(/`/g, '&#96;');

const processInline = (text = '') => {
	const codeSegments = [];
	let placeholderText = text.replace(/`([^`]+)`/g, (_, code) => {
		const token = `@@CODE${codeSegments.length}@@`;
		codeSegments.push(escapeHtml(code));
		return token;
	});

	placeholderText = escapeHtml(placeholderText)
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/\*(.+?)\*/g, '<em>$1</em>');

	codeSegments.forEach((code, index) => {
		placeholderText = placeholderText.replace(`@@CODE${index}@@`, `<code>${code}</code>`);
	});

	return placeholderText;
};

const replaceScreenshots = (html = '') =>
	html.replace(/\[\[IMG:(.+?)]]/g, (_, path) => {
		const cleanPath = path.trim();
		return `<figure class="note-screenshot"><img src="${escapeAttribute(
			cleanPath
		)}" alt="Screenshot ${escapeAttribute(cleanPath)}" /></figure>`;
	});

export function filterForExamPrep(content = '') {
	const lines = content.split('\n');
	const kept = [];
	let inCodeBlock = false;

	for (const line of lines) {
		if (line.trim().startsWith('```')) {
			inCodeBlock = !inCodeBlock;
			kept.push(line);
			continue;
		}

		if (inCodeBlock) {
			kept.push(line);
			continue;
		}

		if (/^- \[[ xX]]/.test(line.trim())) {
			kept.push(line);
			continue;
		}

		if (/^\s*(sudo |# |\$ )/.test(line) || /(nmap|msfconsole|crackmapexec|impacket)/i.test(line)) {
			kept.push(line);
			continue;
		}
	}

	return kept.length > 0
		? kept.join('\n')
		: 'Exam Prep Mode active — walkthrough details are hidden.';
}

export function renderMarkdown(text = '') {
	const replacedScreenshots = text.replace(/!\[\[(.+?)\]\]/g, (_, path) => screenshotToken(path));
	const lines = replacedScreenshots.split('\n');
	let html = '';
	let listOpen = false;
	let inCodeBlock = false;

	const closeListIfNeeded = () => {
		if (listOpen) {
			html += '</ul>';
			listOpen = false;
		}
	};

	lines.forEach((rawLine, index) => {
		const line = rawLine.replace(/\s+$/g, '');

		if (line.trim().startsWith('```')) {
			if (!inCodeBlock) {
				closeListIfNeeded();
				html += '<pre class="note-code"><code>';
				inCodeBlock = true;
			} else {
				html += '</code></pre>';
				inCodeBlock = false;
			}
			return;
		}

		if (inCodeBlock) {
			html += `${escapeHtml(line)}\n`;
			if (index === lines.length - 1) {
				html += '</code></pre>';
				inCodeBlock = false;
			}
			return;
		}

		if (/^\s*- /.test(line)) {
			if (!listOpen) {
				html += '<ul class="note-list">';
				listOpen = true;
			}
			html += `<li>${processInline(line.replace(/^\s*-\s*/, ''))}</li>`;
			return;
		}

		if (line.trim() === '') {
			closeListIfNeeded();
			html += '<br />';
			return;
		}

		closeListIfNeeded();
		html += `<p>${processInline(line)}</p>`;
	});

	closeListIfNeeded();

	if (inCodeBlock) {
		html += '</code></pre>';
	}

	return replaceScreenshots(html);
}
