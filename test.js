curl --location --request POST 'http://xybot-appreciation:8080/api/appreciation/v1/inner/completions/conversation' \
--header 'xybot-user: {"organizationUuid":"写自己的！","tenantUuid":"写自己的！","uuid":"写自己的！"}' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
--header 'Content-Type: application/json' \
--data-raw '{
    "bizCode": "ai-power",
    "bizId": "274335384338436",
    "bizType": "ai_search",
    "channel": "qwen",
    "messages": [
        {
            "role": "system",
            "content": "你是智能文档助手，请你根据用户的问题来回答问题。"
        },
        {
            "role": "user",
            "content": "哈哈哈哈"
        }
    ],
    "model": "qwen-turbo",
    "stream": false,
    "temperature": 0.0,
    "timeout": 180
}'