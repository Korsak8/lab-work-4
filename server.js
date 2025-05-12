const WebSocket = require('ws'); // Імпортуємо бібліотеку WebSocket
const path = require('path'); // Модуль для роботи з шляхами до файлів
const express = require('express'); // Express — веб-фреймворк
const http = require('http'); // Модуль HTTP для створення сервера
const timesyncServer = require('timesync/server'); // Підключення серверної частини timesync

const app = express();
const server = http.createServer(app); // Створення HTTP-сервера на базі Express
const wss = new WebSocket.Server({ server }); // Створення WebSocket-сервера

const PORT = process.env.PORT || 3000; // Порт, на якому працюватиме сервер

// Обслуговування статичних файлів з папки "public"
app.use(express.static(path.join(__dirname, 'public')));

// Обробка запитів бібліотеки timesync
app.use('/timesync', timesyncServer.requestHandler);

// Обробник WebSocket-з'єднань
wss.on('connection', (ws) => {
    console.log(' Встановлено нове WebSocket-з’єднання');
    
    // Подія: отримано повідомлення від клієнта
    ws.on('message', (message) => {
        console.log(`Отримано повідомлення: ${message}`);
        
        let data;
        try {
            data = JSON.parse(message); // Спроба розпарсити повідомлення як JSON
        } catch (e) {
            console.error('❗ Помилка парсингу JSON', e);
            return;
        }

        // Якщо клієнт запитує час
        if (data.type === 'getTime') {
            ws.send(JSON.stringify({
                type: 'time',
                result: Date.now(), // Поточний час на сервері
                id: Date.now() // Ідентифікатор (можна використати для відстеження)
            }));
        }
    });

    // Подія: клієнт закрив з’єднання
    ws.on('close', () => {
        console.log('❌ З’єднання закрито клієнтом');
    });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(`WebSocket-сервер запущено на http://localhost:${PORT}`);
});