// Ініціалізація змінних для зсуву та статистики
let offset = 0; // Зсув часу, обчислений власним методом
let arr_offsets = []; // Масив зсувів, отриманих власним методом
let arr_timesync_offsets = []; // Масив зсувів, отриманих бібліотекою timesync
let methodError = 0; // Похибка між нашим методом та timesync
let isCollecting = true; // Прапорець, що вказує, чи триває збір даних
let start = 0; // Час початку запиту
let ws = null; // WebSocket з'єднання

// Функція для отримання WebSocket URL на основі поточного хоста
function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
}

// Створення об'єкта timesync
const ts = timesync.create({
    server: '/timesync',
    repeat: 0
});

// Обробник події синхронізації timesync
ts.on('sync', function() {
    if (typeof ts.offset !== 'number' || isNaN(ts.offset)) {
        console.error("Помилка: timesync повернув NaN!");
        document.getElementById('syncError').innerText = `Помилка: timesync повернув NaN!`;
        return;
    }

    if (isCollecting && arr_timesync_offsets.length < 60) {
        arr_timesync_offsets.push(ts.offset);
    }

    const currentError = Math.abs(offset - ts.offset);
    console.log("Поточна похибка методу:", currentError);

    document.getElementById('currentErrorStat').textContent = `${currentError.toFixed(2)} мс`;
    document.getElementById('syncError').innerHTML = `
        <strong>Поточна похибка методу:</strong> ${currentError.toFixed(2)} мс<br>
        <strong>Похибка методу:</strong> ${methodError.toFixed(2)} мс
    `;
});

// Основна функція синхронізації часу
function syncTime() {
    if (!isCollecting) {
        arr_offsets = [];
        arr_timesync_offsets = [];
        isCollecting = true;
        document.getElementById('timeOutput').textContent = "Початок нового збору даних...";
        document.getElementById('syncError').textContent = "";
    }

    if (!ws || ws.readyState === WebSocket.CLOSED) {
        ws = new WebSocket(getWebSocketUrl());

        ws.onopen = () => {
            console.log("✅ WebSocket підключено");
            sendTimeRequest();
        };

        ws.onmessage = (event) => {
            const end = performance.now();
            const data = JSON.parse(event.data);

            if (data.type === "time") {
                const roundTripTime = end - start;
                const estimatedClientTime = data.result + roundTripTime / 2;
                offset = estimatedClientTime - Date.now();

                if (isCollecting) {
                    if (arr_offsets.length < 60) {
                        arr_offsets.push(offset);
                    } else {
                        isCollecting = false;
                        document.getElementById('timeOutput').textContent = `Збір даних завершено. Натисніть кнопку для нового збору.`;
                        document.getElementById('syncError').textContent = "Досягнуто максимальної кількості даних (60). Натисніть кнопку для нового збору.";
                    }
                }

                updateStats();
                ts.sync();

                if (isCollecting) {
                    document.getElementById('offsetStat').textContent = `${offset.toFixed(2)} мс`;
                }

                if (arr_offsets.length === 60 && arr_timesync_offsets.length === 60) {
                    const yourStats = calculateStats(arr_offsets);
                    const timesyncStats = calculateStats(arr_timesync_offsets);
                    methodError = Math.abs(yourStats.mode - timesyncStats.mode);
                    document.getElementById('methodErrorStat').textContent = `${methodError.toFixed(2)} мс`;
                }

                if (isCollecting) {
                    setTimeout(sendTimeRequest, 1000);
                }
            }
        };

        ws.onclose = () => {
            console.log("❌ WebSocket з'єднання закрито");
            document.getElementById('timeOutput').textContent = "WebSocket з'єднання закрито";
        };

        ws.onerror = (error) => {
            console.error("WebSocket помилка:", error);
            document.getElementById('timeOutput').textContent = "Помилка WebSocket";
        };
    } else if (ws.readyState === WebSocket.OPEN) {
        sendTimeRequest();
    } else {
        console.warn("⏳ Очікується відкриття WebSocket...");
    }
}

function sendTimeRequest() {
    try {
        start = performance.now();
        ws.send(JSON.stringify({ type: "getTime" }));
    } catch (error) {
        document.getElementById('timeOutput').textContent = "Помилка синхронізації";
        console.error('Помилка:', error);
    }
}

function updateStats() {
    const stats = calculateStats(arr_offsets);
    document.getElementById('countStat').textContent = arr_offsets.length;
    document.getElementById('output').textContent = formatStats(stats);
}

function calculateStats(arr) {
    if (!arr.length) return {};

    arr.sort((a, b) => a - b);
    const min = arr[0];
    const max = arr[arr.length - 1];
    const avg = arr.reduce((sum, num) => sum + num, 0) / arr.length;
    const median = arr.length % 2 === 0 ?
        (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2 :
        arr[Math.floor(arr.length / 2)];
    const q1 = arr[Math.floor(arr.length * 0.25)];
    const q3 = arr[Math.floor(arr.length * 0.75)];
    const iqr = q3 - q1;
    const mode = findMode(arr);
    const variance = arr.reduce((sum, num) => sum + (num - avg) ** 2, 0) / arr.length;
    const stddev = Math.sqrt(variance);

    return { min, q1, median, q3, max, avg, mode, stddev, iqr };
}

function findMode(arr) {
    const freq = {};
    arr.forEach(num => freq[num] = (freq[num] || 0) + 1);
    let maxFreq = 0, mode = null;

    for (const num in freq) {
        if (freq[num] > maxFreq) {
            maxFreq = freq[num];
            mode = Number(num);
        }
    }
    return mode;
}

function formatStats(stats) {
    return `Кількість спостережень: ${arr_offsets.length}
Поправка: ${offset.toFixed(2)} мс
Min: ${stats.min.toFixed(2)} мс
Q1: ${stats.q1.toFixed(2)} мс
Медіана: ${stats.median.toFixed(2)} мс
Середнє: ${stats.avg.toFixed(2)} мс
Мода: ${stats.mode.toFixed(2)} мс
Q3: ${stats.q3.toFixed(2)} мс
Max: ${stats.max.toFixed(2)} мс
Стандартне відхилення: ${stats.stddev.toFixed(2)} мс
IQR: ${stats.iqr.toFixed(2)} мс`;
}

document.addEventListener('DOMContentLoaded', () => {
    updateStats();
});