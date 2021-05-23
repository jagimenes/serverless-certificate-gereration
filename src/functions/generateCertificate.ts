import path from "path";
import fs from "fs";

import { document } from "./utils/dynamodbclient";
import chromium from "chrome-aws-lambda";
import * as handlebars from "handlebars";
import dayjs from "dayjs";
import { S3 } from "aws-sdk";

interface ICreateCertificate {
    id: string;
    name: string;
    grade: string;
}

interface ITemplate {
    id: string;
    name: string;
    grade: string;
    date: string;
    medal: string;
}

const compile = async function(data: ITemplate) {
    const filePath = path.join(process.cwd(), "src", "templates", "certificate.hbs");
    const html = fs.readFileSync(filePath, "utf-8");

    return handlebars.compile(html)(data);
}

export const handle = async (event) => {
    const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;

    const response = await document.query({
        TableName: "users_certificates",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
            ":id": id
        }
    }).promise();

    const user = response.Items[0];

    if (!user) {
        await document.put({
            TableName: "users_certificates",
            Item: {
                id,
                name,
                grade
            }
        }).promise();
    }

    const medalPath = path.join(process.cwd(), "src", "templates", "selo.png");
    const medal = fs.readFileSync(medalPath, "base64");

    const data: ITemplate = {
        date: dayjs().format("DD/MM/YYYY"),
        grade,
        name,
        id,
        medal
    }

    const content = await compile(data);

    const browser = await chromium.puppeteer.launch({
        headless: true,
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath
    });

    const page = await browser.newPage();

    await page.setContent(content);

    const PDF = await page.pdf({
        format: "a4",
        landscape: true,
        path: process.env.IS_OFFLINE ? "certificate.pdf": null,
        printBackground: true,
        preferCSSpageSize: true
    });

    await browser.close();

    const s3 = new S3();

    await s3.putObject({
        Bucket: "ignite-certificates",
        Key: `${id}.pdf`,
        ACL: "public-read",
        Body: PDF,
        ContentType: "application/pdf",
    }).promise();

    
    return {
        statusCode: 201,
        body: JSON.stringify({
            message: "Created.",
            url: `${process.env.BUCKET_URL}/${id}.pdf`
        }),
        headers: {
            "Content-Type": "application/json"
        }
    }
}