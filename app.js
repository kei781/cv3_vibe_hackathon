import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import 'dotenv/config'; // <-- 이 줄을 추가!
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// ES Module 환경에서 __dirname 사용을 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";
console.log("API Key:", apiKey, "Loaded")
const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);

async function runMediaMixAI(userPrompt) {
  try {
    const adDirPath = path.join(__dirname, "ad");
    const uploadedFiles = [];

    // 1. ad 디렉토리 확인 및 .md 파일 목록 가져오기
    if (!fs.existsSync(adDirPath)) {
      console.error(`오류: '${adDirPath}' 디렉토리가 존재하지 않습니다.`);
      return;
    }

    const files = fs.readdirSync(adDirPath);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    if (mdFiles.length === 0) {
      console.log("업로드할 .md 파일이 ad 디렉토리에 없습니다.");
      return;
    }

    console.log(`총 ${mdFiles.length}개의 .md 파일을 찾았습니다. 업로드를 시작합니다...`);

    // 2. .md 파일 순회하며 업로드
    // 파일 업로드 루프(for문) 안에 딜레이 추가
    for (const file of mdFiles) {
    const filePath = path.join(adDirPath, file);
    console.log(`- ${file} 업로드 중...`);
    
    const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType: "text/markdown",
        displayName: file,
    });
    
    uploadedFiles.push(uploadResult.file);
    
    // API Rate Limit 방지를 위해 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    }

    console.log("\n모든 파일 업로드 완료. AI 모델을 호출합니다...");

    // 3. AI 모델 초기화 (gemini-1.5-pro 사용)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "당신은 디지털 광고 플랫폼의 수석 미디어 플래너입니다. 첨부된 매체 소개서 및 단가표(.md) 내의 정보만을 활용하여 사용자의 예산과 타겟에 맞는 최적의 미디어믹스를 제안하세요. 없는 매체를 지어내면 안 됩니다.",
    });

    // 4. 광고주 질문 세팅 및 API 호출
    const prompt = userPrompt || "이번에 공간 리뷰 앱을 런칭합니다. 2030 타겟으로 100만 원 예산을 쓰려고 하는데, 업로드된 매체들을 활용해서 가성비 좋은 미디어믹스를 짜주세요.";

    console.log("AI가 미디어믹스를 생성 중입니다...\n");
    
    // 업로드한 파일 URI 배열과 텍스트 프롬프트를 함께 전달
    const requestContents = [
      ...uploadedFiles.map(file => ({
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri
        }
      })),
      { text: prompt }
    ];

    const result = await model.generateContent(requestContents);

    // 5. 결과 출력
    console.log("========== [AI 미디어믹스 제안] ==========");
    console.log(result.response.text());
    console.log("==========================================");

    // 6. (선택) 비용 및 저장 공간 관리를 위한 파일 정리
    /*
    console.log("\n사용한 파일을 서버에서 삭제합니다...");
    for (const file of uploadedFiles) {
      await fileManager.deleteFile(file.name);
      console.log(`- ${file.displayName} 삭제 완료`);
    }
    */

  } catch (error) {
    console.error("오류가 발생했습니다:", error);
  }
}

runMediaMixAI();