const {
    MaxClient,
    sendMessage,
    deleteMessage,
} = require('vkmax');

const readline = require('readline'); // npm i readline

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function main() {
    console.log()
    const client = new MaxClient();

    try {
        console.log('Connecting...');
        await client.connect();
        let lastmsg = 0;
        let chatId;

        await client.setCallback(async (client, packet) => {
            console.log('incoming event:', JSON.stringify(packet, null, 2));
            if (packet.opcode == 128) { // new message
                if (packet.payload.message.id != lastmsg) {
                    lastmsg = await sendMessage(client, chatId, `did you just write "${packet.payload.message.text}"? ${Math.random() > 0.5 ? 'it bad' : 'it good'}`);
                }
            }
        });

        const phone = await ask('Enter your phone number (e.g. +79991234567): ');
        const token = await client.sendCode(phone);
        console.log('authentication token received');

        const smsCode = await ask('Enter the SMS code you received: ');
        console.log((await client.signIn(token, smsCode)).payload.tokenAttrs.LOGIN.token);
        // await client.loginByToken(''); // Or use a token for login
        console.log('successfully logged in');

        const chatIdInput = await ask('Enter chat ID to interact with: ');
        chatId = parseInt(chatIdInput, 10);

        const testMessage = await sendMessage(client, chatId, 'Halo');
        console.log('message sent');
        console.dir(testMessage.payload)
        const confirmDelete = await ask('Delete the test message? (y/N): ');
        if (confirmDelete.toLowerCase() === 'y') {
            await deleteMessage(client, chatId, [testMessage.payload.message.id], false);
            console.log('message deleted');
        }
        console.log('\nListening for incoming events (Ctrl+C to exit)');
        await new Promise((resolve) => {
            // keep process running
            process.stdin.resume();
            process.stdin.on('end', resolve);
        });

    } catch (err) {
        console.error(err);
    } finally {
        if (client._connection) {
            console.log('disconnecting...');
            await client.disconnect();
        }
        rl.close();
        console.log('connection closed');
    }
}

main().catch(console.error);
