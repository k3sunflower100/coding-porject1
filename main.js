const defaults = {
	appName: "LUCKY SIX",
	initialSets: 1,
	maxSets: 10,
	drawCountOptions: [1, 3, 5, 10]
};

const colorClasses = ["ball-yellow", "ball-blue", "ball-red", "ball-gray", "ball-green"];
const ticketList = document.querySelector("#ticket-list");
const drawButton = document.querySelector("#draw-button");
const countSelect = document.querySelector("#set-count");
const drawMessage = document.querySelector("#draw-message");
const copyButton = document.querySelector("#copy-button");
const latestContent = document.querySelector("#latest-content");
const dataStatus = document.querySelector("#data-status");
let latestSets = [];

function ballColor(number) {
	return colorClasses[Math.min(Math.floor((number - 1) / 10), 4)];
}

function makeBall(number, delayMs = 0, extraClass = "") {
	const ball = document.createElement("span");
	ball.className = `lotto-ball ${ballColor(number)} ${extraClass}`.trim();
	ball.textContent = String(number);
	ball.setAttribute("aria-label", `${number}번`);
	if (delayMs >= 0) ball.style.animationDelay = `${delayMs}ms`;
	return ball;
}

function createNumbers() {
	const pool = Array.from({ length: 45 }, (_, index) => index + 1);
	const numbers = [];

	while (numbers.length < 6) {
		const index = randomIndex(pool.length);
		numbers.push(pool.splice(index, 1)[0]);
	}

	return numbers.sort((left, right) => left - right);
}

function randomIndex(max) {
	if (window.crypto?.getRandomValues) {
		const range = 0x100000000;
		const limit = range - (range % max);
		const value = new Uint32Array(1);
		do {
			window.crypto.getRandomValues(value);
		} while (value[0] >= limit);
		return value[0] % max;
	}
	return Math.floor(Math.random() * max);
}

function renderTickets(sets) {
	ticketList.replaceChildren();
	sets.forEach((numbers, setIndex) => {
		const row = document.createElement("div");
		row.className = "ticket-row";

		const label = document.createElement("span");
		label.className = "ticket-index";
		label.textContent = `SET ${String(setIndex + 1).padStart(2, "0")}`;

		const balls = document.createElement("div");
		balls.className = "ticket-balls";
		balls.setAttribute("aria-label", numbers.join(", "));
		numbers.forEach((number, numberIndex) => {
			balls.append(makeBall(number, numberIndex * 35));
		});

		row.append(label, balls);
		ticketList.append(row);
	});
}

function drawNumbers() {
	const count = Number(countSelect.value);
	if (!Number.isInteger(count) || count < 1 || count > 10) return;

	drawButton.disabled = true;
	window.setTimeout(() => {
		latestSets = Array.from({ length: count }, createNumbers);
		renderTickets(latestSets);
		drawMessage.textContent = `${count}개 조합을 만들었어요. 행운을 빌어요!`;
		copyButton.disabled = false;
		drawButton.disabled = false;
	}, 120);
}

async function copyNumbers() {
	if (!latestSets.length) return;
	const text = latestSets.map((numbers, index) => `SET ${index + 1}: ${numbers.join(", ")}`).join("\n");

	try {
		await navigator.clipboard.writeText(text);
		drawMessage.textContent = "번호를 클립보드에 복사했어요.";
	} catch {
		drawMessage.textContent = "이 브라우저에서는 복사를 사용할 수 없어요.";
	}
}

function renderLatestDraw(draw) {
	const numbers = Array.isArray(draw.numbers) ? draw.numbers : [];
	if (numbers.length !== 6 || numbers.some((number) => !Number.isInteger(number) || number < 1 || number > 45)) {
		throw new Error("당첨 번호 데이터 형식이 올바르지 않습니다.");
	}

	const card = document.createElement("article");
	card.className = "latest-card";

	const meta = document.createElement("div");
	const round = document.createElement("div");
	round.className = "round-label";
	round.textContent = `${draw.round}회 당첨 번호`;
	const date = document.createElement("div");
	date.className = "round-date";
	date.textContent = draw.date || "추첨일 정보 없음";
	meta.append(round, date);

	const balls = document.createElement("div");
	balls.className = "latest-balls";
	numbers.forEach((number) => balls.append(makeBall(number, -1)));

	const bonus = document.createElement("div");
	bonus.className = "bonus-group";
	const bonusLabel = document.createElement("span");
	bonusLabel.className = "bonus-label";
	bonusLabel.textContent = "보너스";
	const bonusBall = document.createElement("span");
	bonusBall.className = `bonus-ball ${ballColor(draw.bonus)}`;
	bonusBall.textContent = String(draw.bonus);
	bonusBall.setAttribute("aria-label", `보너스 ${draw.bonus}번`);
	bonus.append(bonusLabel, bonusBall);

	card.append(meta, balls, bonus);
	latestContent.replaceChildren(card);
	dataStatus.innerHTML = '<span class="status-dot"></span> 데이터 연결됨';
}

async function loadData() {
	try {
		const [configResponse, winningResponse] = await Promise.all([
			fetch("config.json", { cache: "no-store" }),
			fetch("winning_data.json", { cache: "no-store" })
		]);
		if (!configResponse.ok || !winningResponse.ok) throw new Error("데이터 파일을 불러오지 못했습니다.");

		const [config, winningData] = await Promise.all([configResponse.json(), winningResponse.json()]);
		applyConfig({ ...defaults, ...config });

		const draws = Array.isArray(winningData) ? winningData : winningData.rounds;
		if (!Array.isArray(draws) || draws.length === 0) {
			throw new Error("표시할 당첨 이력이 없습니다.");
		}
		const latestDraw = [...draws].sort((left, right) => Number(right.round) - Number(left.round))[0];
		renderLatestDraw(latestDraw);
	} catch (error) {
		dataStatus.innerHTML = '<span class="status-dot"></span> 데이터 확인 필요';
		latestContent.innerHTML = '<div class="latest-error">당첨 정보를 불러오지 못했어요. JSON 파일과 로컬 서버 실행 여부를 확인해 주세요.</div>';
		console.error("데이터 로드 실패:", error);
	}
}

function applyConfig(config) {
	document.title = `${config.appName} | 로또 번호 추첨`;
	const allowedCounts = Array.isArray(config.drawCountOptions)
		? config.drawCountOptions.filter((count) => Number.isInteger(count) && count > 0 && count <= config.maxSets)
		: defaults.drawCountOptions;
	countSelect.replaceChildren(...allowedCounts.map((count) => {
		const option = document.createElement("option");
		option.value = String(count);
		option.textContent = `${count} 조합`;
		return option;
	}));
	countSelect.value = String(allowedCounts.includes(config.initialSets) ? config.initialSets : allowedCounts[0] || 1);
}

drawButton.addEventListener("click", drawNumbers);
copyButton.addEventListener("click", copyNumbers);
loadData();

