const fs = require('fs');
const axios = require('axios');

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendMessage(
    client,
    chatId,
    text,
    notify = true
) {
    return await client.invokeMethod(
        64,
        {
            "chatId": chatId,
            "message": {
                "text": text,
                "cid": getRandomInt(1750000000000, 2000000000000),
                "elements": [],
                "attaches": []
            },
            "notify": notify
        }
    );
}

async function editMessage(
    client,
    chatId,
    messageId,
    text
) {
    return await client.invokeMethod(
        67,
        {
            "chatId": chatId,
            "messageId": String(messageId),
            "text": text,
            "elements": [],
            "attachments": []
        }
    );
}

async function deleteMessage(
    client,
    chatId,
    messageIds,
    deleteForMe = false
) {
    return await client.invokeMethod(
        66,
        {
            "chatId": chatId,
            "messageIds": messageIds,
            "forMe": deleteForMe
        }
    );
}

async function pinMessage(
    client,
    chatId,
    messageId,
    notify = false
) {
    return await client.invokeMethod(
        55,
        {
            "chatId": chatId,
            "notifyPin": notify,
            "pinMessageId": String(messageId)
        }
    );
}

async function replyMessage(
    client,
    chatId,
    text,
    replyToMessageId,
    notify = true
) {
    return await client.invokeMethod(
        64,
        {
            "chatId": chatId,
            "message": {
                "text": text,
                "cid": getRandomInt(1750000000000, 2000000000000),
                "elements": [],
                "link": {
                    "type": "REPLY",
                    "messageId": String(replyToMessageId)
                },
                "attaches": []
            },
            "notify": notify
        }
    );
}

async function sendPhoto(
    client,
    chatId,
    imagePath,
    caption,
    notify = true
) {
    const photoToken = await client.invokeMethod(
        80,
        {
            "count": 1
        }
    );

    const url = photoToken.payload.url;
    const apiToken = url.split('apiToken=')[1];

    const params = {
        'apiToken': apiToken
    };

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://web.max.ru  ',
        'Referer': 'https://web.max.ru/  ',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'cors',
        'Accept-Language': 'ru-RU,ru;q=0.9',
    };

    try {
        const imageBuffer = fs.readFileSync(imagePath);
        
        const formData = new FormData();
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
        formData.append('file', blob, 'image.jpg');

        const response = await axios.post(url, formData, {
            params: params,
            headers: {
                ...headers,
                ...formData.getHeaders() // This will set the correct Content-Type for multipart/form-data
            }
        });

        const uploadedPhoto = response.data;

        await client.invokeMethod(
            64,
            {
                "chatId": chatId,
                "message": {
                    "text": caption,
                    "cid": getRandomInt(1750000000000, 2000000000000),
                    "elements": [],
                    "attaches": [
                        {
                            "_type": "PHOTO",
                            "photoToken": Object.values(uploadedPhoto.photos)[0].token
                        }
                    ]
                },
                "notify": notify
            }
        );
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Error: Make sure '${imagePath}' is in the same directory.`);
        } else {
            console.log(`An error occurred: ${error.message}`);
        }
        throw error;
    }
}

module.exports = {
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    replyMessage,
    sendPhoto
};