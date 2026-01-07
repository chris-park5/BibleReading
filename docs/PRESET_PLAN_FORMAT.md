# 고정(프리셋) 플랜 JSON 형식

이 프로젝트의 고정(프리셋) 플랜은 **`src/app/plans/` 폴더 아래의 `*.json` 파일**로 관리합니다.

중요: 앱은 `src/app/plans/*.json`을 자동으로 수집합니다. 따라서 **새 플랜을 추가/삭제할 때 다른 파일을 수정할 필요가 없습니다.**

## 1) 반드시 지켜야 하는 형식(Required)

아래 필드는 필수입니다.

- `id`: string
  - 고유해야 함(중복 불가)
  - 예: `"one-year"`, `"one-year-psalm-ot-nt"`
- `title`: string
  - 사용자에게 보이는 플랜 이름
- `totalDays`: number
  - 전체 기간(일)
- `schedule`: Array
  - 각 day에 대한 읽기 항목 배열

`schedule` 항목 규칙:

- `schedule[i].day`: number (1부터 시작 권장)
- `schedule[i].readings`: Array
- `schedule[i].readings[j].book`: string
- `schedule[i].readings[j].chapters`: string

## 2) 선택(Optional) 필드

- `description`: string
- `duration`: string (UI에 표시용)
- `schedule[i].date`: string (UI 표시용/관리용)

## 3) 추가/삭제 방법(관리자 워크플로우)

### 추가

1. `src/app/plans/` 아래에 새 파일 `my-plan.json` 생성
2. 위 형식에 맞춰 작성
3. 끝. (다른 파일 수정 없음)

### 삭제

1. `src/app/plans/`에서 해당 `*.json` 파일 삭제
2. 끝. (다른 파일 수정 없음)

## 4) 최소 예시 템플릿

```json
{
  "id": "my-preset-plan",
  "title": "나의 프리셋 플랜",
  "description": "설명(선택)",
  "duration": "30일",
  "totalDays": 30,
  "schedule": [
    {
      "day": 1,
      "readings": [{ "book": "창세기", "chapters": "1" }]
    }
  ]
}
```

## 5) 주의사항

- `id`가 중복되면 앱에서 해당 플랜이 제외되며 콘솔에 에러가 출력됩니다.
- 필수 필드가 누락되거나 타입이 틀리면 앱에서 해당 플랜이 제외되며 콘솔에 에러가 출력됩니다.
