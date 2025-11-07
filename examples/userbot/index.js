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
    const client = new MaxClient();

    try {
        console.log('Connecting...');
        await client.connect();

        await client.setCallback((client, packet) => {
            console.log('incoming event:', JSON.stringify(packet, null, 2));
        });

        const phone = await ask('Enter your phone number (e.g. +79991234567): ');
        const token = await client.sendCode(phone);
        console.log('authentication token received');

        const smsCode = await ask('Enter the SMS code you received: ');
        await client.signIn(token, smsCode);
        console.log('successfully logged in');

        const chatIdInput = await ask('Enter chat ID to interact with: ');
        const chatId = parseInt(chatIdInput, 10);

        const testMessage = await sendMessage(client, chatId, 'Hello world!');
        console.log('message sent');

        const confirmDelete = await ask('Delete the test message? (y/N): ');
        if (confirmDelete.toLowerCase() === 'y') {
            await deleteMessage(client, chatId, [testMessage.payload.messageId], false);
            console.log('message deleted');
        }
        console.log('\nListening for incoming events (Ctrl+C to exit)');
        await new Promise((resolve) => {
            // keep process running
            process.stdin.resume();
            process.stdin.on('end', resolve);
        });

    } catch (error) {
        console.error('error:', error.message);
        console.error(error.stack);
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