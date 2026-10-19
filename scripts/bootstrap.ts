// Run with a trusted service account: node --env-file=.env.local --import tsx scripts/bootstrap.ts CLASS_ID TEACHER_EMAIL
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initialState } from "../lib/seed";
const [classId, email] = process.argv.slice(2);
if (!classId?.match(/^[\w-]{1,40}$/) || !email)
  throw Error("Usage: bootstrap CLASS_ID TEACHER_EMAIL");
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const db = getFirestore();
const ref = db.doc(`classes/${classId}/private/economy`);
await db.runTransaction(async (tx) => {
  if ((await tx.get(ref)).exists)
    throw Error("학급이 이미 존재합니다. 덮어쓰지 않습니다.");
  tx.create(ref, initialState(true));
});
await auth.setCustomUserClaims(user.uid, {
  ...user.customClaims,
  role: "teacher",
  classId,
});
console.log("학급 생성과 교사 권한 설정 완료. 로그아웃 후 다시 로그인하세요.");
