const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const WS_HOST = "wss://ws-api.oneme.ru/websocket";
const RPC_VERSION = 11;
const APP_VERSION = "25.9.15";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

class MaxClient {
    constructor() {
        this._connection = null;
        this._is_logged_in = false;
        this._seq = 1;
        this._keepaliveInterval = null;
        this._incoming_event_callback = null;
        this._pending = new Map();
        this._ws = null;
    }

    _ensureConnected() {
        if (!this._connection) {
            throw new Error("WebSocket not connected. Call .connect() first.");
        }
    }

    async connect() {
        if (this._connection) {
            throw new Error("Already connected");
        }

        console.log(`Connecting to ${WS_HOST}...`);
        
        this._ws = new WebSocket(WS_HOST, {
            headers: {
                'User-Agent': USER_AGENT,
                'Origin': 'https://web.max.ru'
            }
        });

        return new Promise((resolve, reject) => {
            this._ws.on('open', () => {
                this._connection = this._ws;
                console.log('Connected. Receive task started.');
                
                this._ws.on('message', (data) => {
                    this._handleMessage(JSON.parse(data.toString()));
                });

                this._ws.on('error', (error) => {
                    console.error('WebSocket error:', error);
                });

                this._ws.on('close', () => {
                    console.log('WebSocket closed');
                    this._connection = null;
                });

                resolve(this._connection);
            });

            this._ws.on('error', (error) => {
                reject(error);
            });
        });
    }

    async disconnect() {
        this._ensureConnected();
        
        if (this._keepaliveInterval) {
            clearInterval(this._keepaliveInterval);
            this._keepaliveInterval = null;
        }
        
        if (this._ws) {
            this._ws.close();
        }
    }

    async invokeMethod(opcode, payload) {
        this._ensureConnected();
        
        const seq = this._seq++;
        const request = {
            "ver": RPC_VERSION,
            "cmd": 0,
            "seq": seq,
            "opcode": opcode,
            "payload": payload
        };
        
        console.log(`-> REQUEST:`, request);

        return new Promise((resolve, reject) => {
            this._pending.set(seq, { resolve, reject });

            this._ws.send(JSON.stringify(request));
        });
    }

    async setCallback(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('callback must be a function');
        }
        this._incoming_event_callback = callback;
    }

    async _handleMessage(packet) {
        const seq = packet.seq;
        const pending = this._pending.get(seq);
        
        if (pending) {
            this._pending.delete(seq);
            pending.resolve(packet);
        } else {
            if (this._incoming_event_callback) {
                this._incoming_event_callback(this, packet);
            }
        }
    }

    async _sendKeepalivePacket() {
        this._ensureConnected();
        try {
            await this.invokeMethod(1, { "interactive": false });
        } catch (error) {
            console.error('Keepalive packet error:', error);
        }
    }

    async _startKeepaliveTask() {
        this._ensureConnected();
        
        if (this._keepaliveInterval) {
            throw new Error('Keepalive task already started');
        }

        this._keepaliveInterval = setInterval(() => {
            this._sendKeepalivePacket();
        }, 30000); // 30 seconds
    }

    async _stopKeepaliveTask() {
        if (this._keepaliveInterval) {
            clearInterval(this._keepaliveInterval);
            this._keepaliveInterval = null;
        }
    }

    async _sendHelloPacket() {
        this._ensureConnected();
        return await this.invokeMethod(6, {
            "userAgent": {
                "deviceType": "WEB",
                "locale": "ru_RU",
                "osVersion": "macOS",
                "deviceName": "OneMe Client",
                "headerUserAgent": USER_AGENT,
                "deviceLocale": "ru-RU",
                "appVersion": APP_VERSION,
                "screen": "956x1470 2.0x",
                "timezone": "Asia/Vladivostok"
            },
            "deviceId": uuidv4()
        });
    }

    async sendCode(phone) {
        this._ensureConnected();
        await this._sendHelloPacket();
        const startAuthResponse = await this.invokeMethod(17, {
            "phone": phone,
            "type": "START_AUTH",
            "language": "ru"
        });
        return startAuthResponse.payload.token;
    }

    async signIn(smsToken, smsCode) {
        this._ensureConnected();
        const verificationResponse = await this.invokeMethod(18, {
            "token": smsToken,
            "verifyCode": smsCode.toString(),
            "authTokenType": "CHECK_CODE"
        });

        if (verificationResponse.payload.error) {
            throw new Error(verificationResponse.payload.error);
        }

        let phone = '[?]';
        try {
            phone = verificationResponse.payload.profile.phone;
        } catch {
            console.warn('Got no phone number in server response');
        }
        console.log(`Successfully logged in as ${phone}`);

        this._is_logged_in = true;
        await this._startKeepaliveTask();

        return verificationResponse;
    }

    async loginByToken(token) {
        this._ensureConnected();
        await this._sendHelloPacket();
        console.log("using session");
        
        const loginResponse = await this.invokeMethod(19, {
            "interactive": true,
            "token": token,
            "chatsSync": 0,
            "contactsSync": 0,
            "presenceSync": 0,
            "draftsSync": 0,
            "chatsCount": 40
        });

        if (loginResponse.payload.error) {
            throw new Error(loginResponse.payload.error);
        }

        let phone = '[?]';
        try {
            phone = loginResponse.payload.profile.phone;
        } catch {
            console.warn('Got no phone number in server response');
        }
        console.log(`Successfully logged in as ${phone}`);

        this._is_logged_in = true;
        await this._startKeepaliveTask();

        return loginResponse;
    }
}

module.exports = MaxClient;