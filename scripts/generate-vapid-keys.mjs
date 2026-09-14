import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("Add these to your environment (.env / Railway Variables):\n");
console.log(`VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_SUBJECT="mailto:support@heresnow.in"`);
console.log(`CRON_SECRET="<random-secret-at-least-32-chars>"`);
