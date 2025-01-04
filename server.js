// server.js

const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// アプリケーションの初期化
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ポート番号の設定（必要に応じて変更してください）
const PORT =3000;

// ミドルウェア: すべてのリクエストをログに出力（デバッグ用）
app.use((req, res, next) => {
    console.log(`リクエスト: ${req.method} ${req.url}`);
    next();
});

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// ルート: 管理画面を提供
app.get('/control', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'control.html'));
});

// ルート: 表示画面を提供
app.get('/display', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

// ルート: 参加者用コメントページを提供
app.get('/participant', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'participant.html'));
});

// タイマーの状態を管理するオブジェクト
let timer = {
    totalTime: 0,        // 総時間（秒）
    remainingTime: 0,    // 残り時間（秒）
    interval: null,      // setInterval の参照
    isRunning: false     // タイマーが動作中かどうか
};

// コメントを保存する配列（サーバーが再起動するとリセットされます）
let comments = [];

// Socket.io の接続イベント
io.on('connection', (socket) => {
    console.log('クライアントが接続しました:', socket.id);

    // クライアントに現在のタイマー状態を送信
    socket.emit('update', {
        type: timer.isRunning ? 'start' : 'reset',
        totalTime: timer.totalTime,
        remainingTime: timer.remainingTime
    });

    // クライアントに既存のコメントを送信
    comments.forEach((comment) => {
        socket.emit('newComment', comment);
    });

    // 管理画面からのメッセージを処理
    socket.on('control', (data) => {
        switch(data.type) {
            case 'start':
                if (timer.isRunning) {
                    clearInterval(timer.interval);
                }
                timer.totalTime = data.totalTime;
                timer.remainingTime = data.remainingTime;
                timer.isRunning = true;
                io.emit('update', { type: 'start', totalTime: timer.totalTime, remainingTime: timer.remainingTime });
                timer.interval = setInterval(() => {
                    timer.remainingTime--;
                    if (timer.remainingTime <= 0) {
                        clearInterval(timer.interval);
                        timer.isRunning = false;
                        io.emit('update', { type: 'end' });
                    } else {
                        io.emit('update', { type: 'update', remainingTime: timer.remainingTime });
                    }
                }, 1000);
                break;
            case 'stop':
                if (timer.isRunning) {
                    clearInterval(timer.interval);
                    timer.isRunning = false;
                    io.emit('update', { type: 'stop', remainingTime: timer.remainingTime });
                }
                break;
            case 'reset':
                if (timer.isRunning) {
                    clearInterval(timer.interval);
                }
                timer.remainingTime = timer.totalTime;
                timer.isRunning = false;
                io.emit('update', { type: 'reset', remainingTime: timer.remainingTime });
                break;
            default:
                console.log('不明な制御タイプ:', data.type);
                break;
        }
    });

    // 参加者からのコメントを処理
    socket.on('comment', (data) => {
        const comment = {
            id: Date.now(),                          // ユニークなID
            name: data.name || '匿名',               // 名前（デフォルト: 匿名）
            message: data.message,                   // コメント内容
            timestamp: new Date().toLocaleTimeString() // タイムスタンプ
        };
        comments.push(comment); // コメントを保存
        io.emit('newComment', comment); // 全クライアントに新コメントを送信
    });

    // クライアントが切断したときの処理
    socket.on('disconnect', () => {
        console.log('クライアントが切断しました:', socket.id);
    });
});

// サーバーの起動
server.listen(PORT, '0.0.0.0', () => { // '0.0.0.0' で全てのネットワークインターフェースにバインド
    console.log(`サーバーがポート ${PORT} で起動しました。`);
    console.log(`管理画面: http://localhost:${PORT}/control`);
    console.log(`表示画面: http://localhost:${PORT}/display`);
    console.log(`参加者コメントページ: http://localhost:${PORT}/participant`);
});