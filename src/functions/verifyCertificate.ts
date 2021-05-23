import { APIGatewayProxyHandler } from "aws-lambda";

import { document } from "./utils/dynamodbclient";

export const handle: APIGatewayProxyHandler = async (event) => {
    const { id } = event.pathParameters;

    const response = await document.query({
        TableName: "users_certificates",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
            ":id": id
        }
    }).promise();

    const user = response.Items[0];

    if (user) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Certificado válido",
                name: user.name,
                url: `${process.env.BUCKET_URL}/${id}.pdf`
            })
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Invalid certificate"
        })
    }
}