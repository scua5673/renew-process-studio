// 애니띵 모닝 — 영어 과정: 왕초보 생활 회화 (12장면 × 5표현)
// 카드 모양: { id, unit, t(영어), pron(대략적인 한글 발음), ko(뜻), blank(t 안의 핵심 덩어리), note(쓰임 팁) }
// 대화: A = 상대, B = 나(학습자). B의 대사는 대부분 그 장면의 카드 문장이에요.
window.AM_EN = {
  version: 1,
  units: [
    {
      id: 'en-u01',
      name: '인사',
      desc: '만나고 헤어질 때, 고맙거나 미안할 때 하는 기본 인사',
      dialogue: [
        { who: 'A', t: 'Good morning!', pron: '굿 모닝!', ko: '좋은 아침이에요!' },
        { who: 'B', t: 'Hi, how are you?', pron: '하이, 하우 아 유?', ko: '안녕하세요, 잘 지내세요?' },
        { who: 'A', t: "I'm great. How about you?", pron: '아임 그레잇. 하우 어바웃 유?', ko: '아주 좋아요. 당신은요?' },
        { who: 'B', t: "I'm good, thanks.", pron: '아임 굿, 땡스', ko: '잘 지내요, 고마워요.' },
        { who: 'A', t: 'Oh, you dropped this.', pron: '오, 유 드랍트 디스', ko: '어, 이거 떨어뜨리셨어요.' },
        { who: 'B', t: 'Thank you so much.', pron: '땡큐 쏘 머치', ko: '정말 고마워요.' },
        { who: 'A', t: 'No problem. Have a good day!', pron: '노 프라블럼. 해버 굿 데이!', ko: '별말씀을요. 좋은 하루 보내요!' },
        { who: 'B', t: 'See you later!', pron: '씨 유 레이러!', ko: '또 봐요!' }
      ]
    },
    {
      id: 'en-u02',
      name: '자기소개',
      desc: '이름·출신·하는 일을 말하고 반갑게 인사하기',
      dialogue: [
        { who: 'A', t: "Hi, I'm Tom.", pron: '하이, 아임 탐', ko: '안녕하세요, 저는 톰이에요.' },
        { who: 'B', t: "Hi, I'm Minji. Nice to meet you.", pron: '하이, 아임 민지. 나이스 터 미츄', ko: '안녕하세요, 저는 민지예요. 만나서 반가워요.' },
        { who: 'A', t: 'Nice to meet you, too. Where are you from?', pron: '나이스 터 미츄, 투. 웨어 아 유 프럼?', ko: '저도 반가워요. 어디서 오셨어요?' },
        { who: 'B', t: "I'm from Korea.", pron: '아임 프럼 코리아', ko: '저는 한국에서 왔어요.' },
        { who: 'A', t: "Cool! I'm from Canada.", pron: '쿨! 아임 프럼 캐나다', ko: '멋지네요! 저는 캐나다에서 왔어요.' },
        { who: 'B', t: 'What do you do?', pron: '왓 두 유 두?', ko: '무슨 일 하세요?' },
        { who: 'A', t: "I'm a teacher. How about you?", pron: '아임 어 티처. 하우 어바웃 유?', ko: '저는 선생님이에요. 당신은요?' },
        { who: 'B', t: 'I work at a bank.', pron: '아이 웍 애러 뱅크', ko: '저는 은행에서 일해요.' }
      ]
    },
    {
      id: 'en-u03',
      name: '카페에서',
      desc: '음료를 주문하고 사이즈와 매장·포장 고르기',
      dialogue: [
        { who: 'A', t: 'Hi! What can I get for you?', pron: '하이! 왓 캐나이 겟 포 유?', ko: '안녕하세요! 뭘로 드릴까요?' },
        { who: 'B', t: 'Can I get an iced latte?', pron: '캐나이 게런 아이스 라테?', ko: '아이스 라테 한 잔 주시겠어요?' },
        { who: 'A', t: 'Sure. What size?', pron: '슈어. 왓 사이즈?', ko: '네. 사이즈는요?' },
        { who: 'B', t: 'Medium, please.', pron: '미디엄, 플리즈', ko: '미디엄으로 주세요.' },
        { who: 'A', t: 'For here or to go?', pron: '포 히어 오어 투 고우?', ko: '드시고 가세요, 가져가세요?' },
        { who: 'B', t: 'To go, please.', pron: '투 고우, 플리즈', ko: '가져갈게요.' },
        { who: 'A', t: 'Anything else?', pron: '애니씽 엘스?', ko: '더 필요한 건 없으세요?' },
        { who: 'B', t: "That's all, thanks.", pron: '댓츠 올, 땡스', ko: '그거면 돼요, 고마워요.' }
      ]
    },
    {
      id: 'en-u04',
      name: '식당에서',
      desc: '인원 말하기부터 메뉴 추천, 주문, 계산까지',
      dialogue: [
        { who: 'A', t: 'Hi! How many?', pron: '하이! 하우 메니?', ko: '안녕하세요! 몇 분이세요?' },
        { who: 'B', t: 'Table for two, please.', pron: '테이블 포 투, 플리즈', ko: '두 명이에요.' },
        { who: 'A', t: 'Sure. Here are your menus.', pron: '슈어. 히어 아 유어 메뉴즈', ko: '네. 메뉴 여기 있어요.' },
        { who: 'B', t: 'What do you recommend?', pron: '왓 두 유 레커멘드?', ko: '추천해 주실 메뉴 있어요?' },
        { who: 'A', t: 'The chicken salad is really good.', pron: '더 치킨 샐러드 이즈 리얼리 굿', ko: '치킨 샐러드가 정말 맛있어요.' },
        { who: 'B', t: "I'd like the chicken salad.", pron: '아이드 라익 더 치킨 샐러드', ko: '치킨 샐러드로 할게요.' },
        { who: 'A', t: 'How was everything?', pron: '하우 워즈 에브리씽?', ko: '식사는 어떠셨어요?' },
        { who: 'B', t: 'Great! Could we get the check?', pron: '그레잇! 쿠드 위 겟 더 첵?', ko: '아주 좋았어요! 계산서 주시겠어요?' }
      ]
    },
    {
      id: 'en-u05',
      name: '길 묻기',
      desc: '가는 길과 거리, 걸리는 시간 묻기',
      dialogue: [
        { who: 'B', t: "Excuse me, where's the subway station?", pron: '익스큐즈 미, 웨어즈 더 써브웨이 스테이션?', ko: '실례지만, 지하철역이 어디예요?' },
        { who: 'A', t: 'Go straight and turn left.', pron: '고우 스트레잇 앤 턴 레프트', ko: '쭉 가다가 왼쪽으로 도세요.' },
        { who: 'B', t: 'Is it far from here?', pron: '이짓 파 프럼 히어?', ko: '여기서 멀어요?' },
        { who: 'A', t: "No, it's pretty close.", pron: '노우, 잇츠 프리티 클로우스', ko: '아뇨, 꽤 가까워요.' },
        { who: 'B', t: 'How long does it take?', pron: '하우 롱 더짓 테익?', ko: '얼마나 걸려요?' },
        { who: 'A', t: 'About five minutes on foot.', pron: '어바웃 파이브 미닛츠 온 풋', ko: '걸어서 5분쯤이요.' },
        { who: 'B', t: 'Can you show me on the map?', pron: '캐뉴 쇼우 미 온 더 맵?', ko: '지도에서 보여 주실 수 있어요?' },
        { who: 'A', t: "Sure. It's right here.", pron: '슈어. 잇츠 라잇 히어', ko: '그럼요. 바로 여기예요.' }
      ]
    },
    {
      id: 'en-u06',
      name: '쇼핑과 계산',
      desc: '가격 묻기, 물건 고르기, 카드로 계산하기',
      dialogue: [
        { who: 'A', t: 'Hi! Can I help you?', pron: '하이! 캐나이 헬퓨?', ko: '안녕하세요! 도와드릴까요?' },
        { who: 'B', t: "I'm just looking, thanks.", pron: '아임 저슷 루킹, 땡스', ko: '그냥 구경하는 중이에요, 감사해요.' },
        { who: 'A', t: 'Sure. Take your time.', pron: '슈어. 테익 유어 타임', ko: '네, 천천히 보세요.' },
        { who: 'B', t: 'How much is this?', pron: '하우 머치 이즈 디스?', ko: '이거 얼마예요?' },
        { who: 'A', t: "It's twenty dollars.", pron: '잇츠 트웨니 달러즈', ko: '20달러예요.' },
        { who: 'B', t: "I'll take this one.", pron: '아일 테익 디스 원', ko: '이걸로 할게요.' },
        { who: 'A', t: 'Great! Anything else?', pron: '그레잇! 애니씽 엘스?', ko: '좋아요! 더 필요한 건요?' },
        { who: 'B', t: 'No, thanks. Can I pay with a card?', pron: '노우, 땡스. 캐나이 페이 위더 카드?', ko: '아뇨, 괜찮아요. 카드로 계산해도 돼요?' }
      ]
    },
    {
      id: 'en-u07',
      name: '대중교통과 택시',
      desc: '버스 확인하기, 요금 묻기, 택시에서 목적지 말하기',
      dialogue: [
        { who: 'B', t: 'Hi. Does this bus go downtown?', pron: '하이. 더즈 디스 버스 고우 다운타운?', ko: '안녕하세요. 이 버스 시내 가요?' },
        { who: 'A', t: 'Yes, it does.', pron: '예스, 잇 더즈', ko: '네, 가요.' },
        { who: 'B', t: 'How much is the fare?', pron: '하우 머치 이즈 더 페어?', ko: '요금이 얼마예요?' },
        { who: 'A', t: "It's two fifty.", pron: '잇츠 투 피프티', ko: '2달러 50센트예요.' },
        { who: 'B', t: 'Could you tell me when to get off?', pron: '쿠쥬 텔 미 웬 투 게로프?', ko: '내릴 때 알려 주시겠어요?' },
        { who: 'A', t: 'Sure. Where are you going?', pron: '슈어. 웨어 아 유 고잉?', ko: '그럼요. 어디 가세요?' },
        { who: 'B', t: 'To City Hall, please.', pron: '투 시티 홀, 플리즈', ko: '시청이요.' },
        { who: 'A', t: "Okay. I'll let you know.", pron: '오케이. 아일 레츄 노우', ko: '네, 알려 드릴게요.' }
      ]
    },
    {
      id: 'en-u08',
      name: '호텔에서',
      desc: '체크인하고 예약 이름 말하기, 짐 맡기기',
      dialogue: [
        { who: 'B', t: "Hi. I'd like to check in.", pron: '하이. 아이드 라익 투 체킨', ko: '안녕하세요. 체크인하려고요.' },
        { who: 'A', t: "Sure. What's the name?", pron: '슈어. 왓츠 더 네임?', ko: '네. 성함이 어떻게 되세요?' },
        { who: 'B', t: "It's under Kim.", pron: '잇츠 언더 킴', ko: '김 이름으로 예약했어요.' },
        { who: 'A', t: 'Thanks. Your room will be ready at three.', pron: '땡스. 유어 룸 윌 비 레디 앳 쓰리', ko: '감사합니다. 방은 3시에 준비돼요.' },
        { who: 'B', t: 'Can I leave my bags here?', pron: '캐나이 리브 마이 백즈 히어?', ko: '여기 짐 좀 맡겨도 될까요?' },
        { who: 'A', t: 'Of course.', pron: '오브 코스', ko: '물론이죠.' },
        { who: 'B', t: 'What time is checkout?', pron: '왓 타임 이즈 체카웃?', ko: '체크아웃은 몇 시예요?' },
        { who: 'A', t: "It's at eleven.", pron: '잇츠 앳 일레븐', ko: '11시예요.' }
      ]
    },
    {
      id: 'en-u09',
      name: '취미 이야기',
      desc: '취미를 묻고 답하고, 같이 하자고 말하기',
      dialogue: [
        { who: 'B', t: 'What do you do for fun?', pron: '왓 두 유 두 포 펀?', ko: '취미가 뭐예요?' },
        { who: 'A', t: 'I play tennis on weekends.', pron: '아이 플레이 테니스 온 위켄즈', ko: '주말마다 테니스 쳐요.' },
        { who: 'B', t: 'That sounds fun!', pron: '댓 사운즈 펀!', ko: '재밌겠네요!' },
        { who: 'A', t: 'Yeah, it is! How about you?', pron: '예, 잇 이즈! 하우 어바웃 유?', ko: '네, 재밌어요! 당신은요?' },
        { who: 'B', t: "I'm really into hiking.", pron: '아임 리얼리 인투 하이킹', ko: '요즘 등산에 푹 빠졌어요.' },
        { who: 'A', t: 'Oh, I love hiking, too!', pron: '오, 아이 러브 하이킹, 투!', ko: '오, 저도 등산 정말 좋아해요!' },
        { who: 'B', t: "Let's go hiking together sometime!", pron: '렛츠 고우 하이킹 투게더 썸타임!', ko: '언제 같이 등산 가요!' },
        { who: 'A', t: 'Sounds great!', pron: '사운즈 그레잇!', ko: '좋아요!' }
      ]
    },
    {
      id: 'en-u10',
      name: '약속 잡기',
      desc: '시간이 되는지 묻고, 시간과 장소 정하기',
      dialogue: [
        { who: 'B', t: 'Are you free this Saturday?', pron: '아 유 프리 디스 쌔러데이?', ko: '이번 토요일에 시간 돼요?' },
        { who: 'A', t: "Yes, I am. Let's get lunch!", pron: '예스, 아이 엠. 렛츠 겟 런치!', ko: '네, 돼요. 점심 같이 먹어요!' },
        { who: 'B', t: "Great! How about one o'clock?", pron: '그레잇! 하우 어바웃 원 어클락?', ko: '좋아요! 1시 어때요?' },
        { who: 'A', t: 'Perfect!', pron: '퍼펙트!', ko: '딱 좋아요!' },
        { who: 'B', t: 'Where should we meet?', pron: '웨어 슈드 위 밋?', ko: '어디서 만날까요?' },
        { who: 'A', t: 'Anywhere is fine.', pron: '애니웨어 이즈 파인', ko: '어디든 괜찮아요.' },
        { who: 'B', t: "Let's meet at the station.", pron: '렛츠 밋 앳 더 스테이션', ko: '역에서 만나요.' },
        { who: 'A', t: 'Okay, see you then!', pron: '오케이, 씨 유 덴!', ko: '좋아요, 그때 봐요!' }
      ]
    },
    {
      id: 'en-u11',
      name: '날씨와 안부',
      desc: '날씨로 말을 걸고, 안부와 주말 이야기 나누기',
      dialogue: [
        { who: 'A', t: 'Hey! Long time no see!', pron: '헤이! 롱 타임 노우 씨!', ko: '와! 오랜만이에요!' },
        { who: 'B', t: 'Hi! How have you been?', pron: '하이! 하우 해뷰 빈?', ko: '안녕하세요! 그동안 잘 지냈어요?' },
        { who: 'A', t: 'Pretty good, thanks. And you?', pron: '프리티 굿, 땡스. 앤 유?', ko: '잘 지냈어요. 당신은요?' },
        { who: 'B', t: "Good! It's so hot today.", pron: '굿! 잇츠 쏘 핫 투데이', ko: '잘 지냈죠! 오늘 너무 덥네요.' },
        { who: 'A', t: 'I know! It feels like summer.', pron: '아이 노우! 잇 필즈 라익 써머', ko: '그러게요! 꼭 여름 같아요.' },
        { who: 'B', t: 'How was your weekend?', pron: '하우 워즈 유어 위켄드?', ko: '주말 잘 보냈어요?' },
        { who: 'A', t: 'Great! I went to the beach. And you?', pron: '그레잇! 아이 웬 투 더 비치. 앤 유?', ko: '좋았어요! 바닷가에 다녀왔어요. 당신은요?' },
        { who: 'B', t: 'I just stayed home and relaxed.', pron: '아이 저슷 스테이드 홈 앤 릴랙스트', ko: '그냥 집에서 쉬었어요.' }
      ]
    },
    {
      id: 'en-u12',
      name: '도움이 필요할 때',
      desc: '못 알아들었을 때 다시 묻고, 도움 요청하기',
      dialogue: [
        { who: 'B', t: 'Excuse me, could you help me?', pron: '익스큐즈 미, 쿠쥬 헬프 미?', ko: '실례지만, 좀 도와주시겠어요?' },
        { who: 'A', t: 'Sure. What do you need?', pron: '슈어. 왓 두 유 니드?', ko: '그럼요. 뭐가 필요하세요?' },
        { who: 'B', t: 'Does this bus go to the airport?', pron: '더즈 디스 버스 고우 투 디 에어포트?', ko: '이 버스 공항 가요?' },
        { who: 'A', t: 'No. Take the 42 bus on Main Street.', pron: '노우. 테익 더 포티투 버스 온 메인 스트릿', ko: '아뇨. 메인 스트리트에서 42번 버스를 타세요.' },
        { who: 'B', t: 'Sorry, could you say that again?', pron: '쏘리, 쿠쥬 쎄이 댓 어겐?', ko: '죄송한데, 다시 한번 말해 주시겠어요?' },
        { who: 'A', t: 'The 42 bus. On Main Street.', pron: '더 포티투 버스. 온 메인 스트릿', ko: '42번 버스요. 메인 스트리트에서요.' },
        { who: 'B', t: 'Could you write it down?', pron: '쿠쥬 라이릿 다운?', ko: '적어 주시겠어요?' },
        { who: 'A', t: 'Sure. Here you go.', pron: '슈어. 히어 유 고우', ko: '그럼요. 여기요.' }
      ]
    }
  ],
  cards: [
    // ───────── 1. 인사 ─────────
    {
      id: 'en-u01-01',
      unit: 'en-u01',
      t: 'Hi, how are you?',
      pron: '하이, 하우 아 유?',
      ko: '안녕하세요, 잘 지내세요?',
      blank: 'how are you',
      note: '만나면 가장 먼저 하는 인사예요. 진짜 안부를 묻는다기보다 “안녕하세요”에 가까워서 짧게 답하면 돼요.'
    },
    {
      id: 'en-u01-02',
      unit: 'en-u01',
      t: "I'm good, thanks.",
      pron: '아임 굿, 땡스',
      ko: '잘 지내요, 고마워요.',
      blank: "I'm good",
      note: 'How are you?에 대한 가장 흔한 대답이에요. 뒤에 How about you?(당신은요?)를 붙이면 상대에게도 물어볼 수 있어요.'
    },
    {
      id: 'en-u01-03',
      unit: 'en-u01',
      t: 'Thank you so much.',
      pron: '땡큐 쏘 머치',
      ko: '정말 고마워요.',
      blank: 'so much',
      note: 'Thank you보다 마음이 더 담긴 말이에요. 상대가 고맙다고 하면 You’re welcome.(천만에요)으로 답해요.'
    },
    {
      id: 'en-u01-04',
      unit: 'en-u01',
      t: "I'm so sorry.",
      pron: '아임 쏘 쏘리',
      ko: '정말 미안해요.',
      blank: 'so sorry',
      note: '진심으로 사과할 때 써요. 살짝 부딪힌 정도라면 Sorry! 한마디면 충분해요.'
    },
    {
      id: 'en-u01-05',
      unit: 'en-u01',
      t: 'See you later!',
      pron: '씨 유 레이러!',
      ko: '또 봐요!',
      blank: 'See you',
      note: '아는 사람과 헤어질 때 써요. 내일 또 볼 사이라면 See you tomorrow! 라고 해요.'
    },

    // ───────── 2. 자기소개 ─────────
    {
      id: 'en-u02-01',
      unit: 'en-u02',
      t: "Hi, I'm Minji.",
      pron: '하이, 아임 민지',
      ko: '안녕하세요, 저는 민지예요.',
      blank: "Hi, I'm",
      note: '이름을 말하는 가장 자연스러운 방법이에요. Minji 자리에 내 이름을 넣고, My name is ~ 보다 가볍게 많이 써요.'
    },
    {
      id: 'en-u02-02',
      unit: 'en-u02',
      t: 'Nice to meet you.',
      pron: '나이스 터 미츄',
      ko: '만나서 반가워요.',
      blank: 'meet you',
      note: '처음 만났을 때 써요. 상대가 먼저 말하면 Nice to meet you, too.(저도 반가워요)라고 답해요.'
    },
    {
      id: 'en-u02-03',
      unit: 'en-u02',
      t: "I'm from Korea.",
      pron: '아임 프럼 코리아',
      ko: '저는 한국에서 왔어요.',
      blank: "I'm from",
      note: '“어디서 왔어요?(Where are you from?)”에 대한 대답이에요. 도시 이름을 넣어도 돼요: I’m from Busan.'
    },
    {
      id: 'en-u02-04',
      unit: 'en-u02',
      t: 'I work at a bank.',
      pron: '아이 웍 애러 뱅크',
      ko: '저는 은행에서 일해요.',
      blank: 'I work at',
      note: 'I work at 뒤에 일하는 곳을 넣어요. 학생이면 I’m a student., 은퇴했다면 I’m retired. 라고 해요.'
    },
    {
      id: 'en-u02-05',
      unit: 'en-u02',
      t: 'What do you do?',
      pron: '왓 두 유 두?',
      ko: '무슨 일 하세요?',
      blank: 'What do you do',
      note: '직업을 물을 때 써요. 처음 만난 자리에서 자주 나오는 질문이라 내 대답도 미리 준비해 두면 좋아요.'
    },

    // ───────── 3. 카페에서 ─────────
    {
      id: 'en-u03-01',
      unit: 'en-u03',
      t: 'Can I get an iced latte?',
      pron: '캐나이 게런 아이스 라테?',
      ko: '아이스 라테 한 잔 주시겠어요?',
      blank: 'Can I get',
      note: '주문할 때 가장 많이 쓰는 표현이에요. 뒤에 메뉴만 바꾸면 되고, 더 공손하게는 Could I get ~? 이라고 해요.'
    },
    {
      id: 'en-u03-02',
      unit: 'en-u03',
      t: 'Medium, please.',
      pron: '미디엄, 플리즈',
      ko: '미디엄으로 주세요.',
      blank: 'Medium',
      note: '“사이즈는요?(What size?)”라고 물으면 small, medium, large 중 하나에 please만 붙여 답하면 돼요.'
    },
    {
      id: 'en-u03-03',
      unit: 'en-u03',
      t: 'To go, please.',
      pron: '투 고우, 플리즈',
      ko: '가져갈게요.',
      blank: 'To go',
      note: '“드시고 가세요, 가져가세요?(For here or to go?)”에 대한 대답이에요. 매장에서 마시면 For here, please. 라고 해요.'
    },
    {
      id: 'en-u03-04',
      unit: 'en-u03',
      t: 'Do you have decaf?',
      pron: '두 유 해브 디캐프?',
      ko: '디카페인 있어요?',
      blank: 'Do you have',
      note: '원하는 게 있는지 물을 때 Do you have ~? 를 써요: Do you have oat milk?(귀리 우유 있어요?)'
    },
    {
      id: 'en-u03-05',
      unit: 'en-u03',
      t: "That's all, thanks.",
      pron: '댓츠 올, 땡스',
      ko: '그거면 돼요, 고마워요.',
      blank: "That's all",
      note: '“더 필요한 건 없으세요?(Anything else?)”라고 물을 때 주문을 마무리하는 말이에요. That’s it. 이라고도 해요.'
    },

    // ───────── 4. 식당에서 ─────────
    {
      id: 'en-u04-01',
      unit: 'en-u04',
      t: 'Table for two, please.',
      pron: '테이블 포 투, 플리즈',
      ko: '두 명이에요.',
      blank: 'for two',
      note: '식당에서 “몇 분이세요?(How many?)”라고 물으면 two 자리에 인원수를 넣어 답해요. 짧게 Two, please. 라고 해도 돼요.'
    },
    {
      id: 'en-u04-02',
      unit: 'en-u04',
      t: 'What do you recommend?',
      pron: '왓 두 유 레커멘드?',
      ko: '추천해 주실 메뉴 있어요?',
      blank: 'recommend',
      note: '뭘 먹을지 고민될 때 직원에게 추천을 부탁하는 말이에요. 카페나 가게에서도 똑같이 쓸 수 있어요.'
    },
    {
      id: 'en-u04-03',
      unit: 'en-u04',
      t: "I'd like the chicken salad.",
      pron: '아이드 라익 더 치킨 샐러드',
      ko: '치킨 샐러드로 할게요.',
      blank: "I'd like",
      note: '주문할 때 쓰는 공손한 표현이에요. I’ll have ~ 도 같은 뜻으로 자주 써요.'
    },
    {
      id: 'en-u04-04',
      unit: 'en-u04',
      t: 'Can I get some water?',
      pron: '캐나이 겟 썸 워러?',
      ko: '물 좀 주시겠어요?',
      blank: 'some water',
      note: '카페에서 배운 Can I get ~? 을 식당에서도 그대로 써요. 앞에 Excuse me, 를 붙이면 직원을 부를 때도 자연스러워요.'
    },
    {
      id: 'en-u04-05',
      unit: 'en-u04',
      t: 'Could we get the check?',
      pron: '쿠드 위 겟 더 첵?',
      ko: '계산서 주시겠어요?',
      blank: 'the check',
      note: '미국 식당은 보통 자리에 앉은 채로 계산해요. 짧게 Check, please. 라고 해도 되고, 팁은 따로 남기는 게 일반적이에요.'
    },

    // ───────── 5. 길 묻기 ─────────
    {
      id: 'en-u05-01',
      unit: 'en-u05',
      t: "Excuse me, where's the subway station?",
      pron: '익스큐즈 미, 웨어즈 더 써브웨이 스테이션?',
      ko: '실례지만, 지하철역이 어디예요?',
      blank: "where's",
      note: '모르는 사람에게는 Excuse me로 말을 걸어요. where’s는 where is를 줄인 말이고 뒤에 찾는 곳을 넣어요: Where’s the restroom?'
    },
    {
      id: 'en-u05-02',
      unit: 'en-u05',
      t: "I'm looking for this place.",
      pron: '아임 루킹 포 디스 플레이스',
      ko: '여기를 찾고 있어요.',
      blank: 'looking for',
      note: '지도나 주소를 보여 주며 말하면 영어가 서툴러도 쉽게 통해요. 장소 이름을 넣어도 돼요: I’m looking for a pharmacy.'
    },
    {
      id: 'en-u05-03',
      unit: 'en-u05',
      t: 'Is it far from here?',
      pron: '이짓 파 프럼 히어?',
      ko: '여기서 멀어요?',
      blank: 'far from here',
      note: '거리가 먼지 물어요. 가까운지 물을 땐 Is it close?(가까워요?)라고 해요.'
    },
    {
      id: 'en-u05-04',
      unit: 'en-u05',
      t: 'How long does it take?',
      pron: '하우 롱 더짓 테익?',
      ko: '얼마나 걸려요?',
      blank: 'How long',
      note: '걸리는 시간을 물을 때 써요. 대답은 보통 About ten minutes.(10분쯤이요)처럼 와요.'
    },
    {
      id: 'en-u05-05',
      unit: 'en-u05',
      t: 'Can you show me on the map?',
      pron: '캐뉴 쇼우 미 온 더 맵?',
      ko: '지도에서 보여 주실 수 있어요?',
      blank: 'show me',
      note: '휴대폰 지도를 내밀며 부탁해 보세요. 말로만 듣는 것보다 훨씬 확실해요.'
    },

    // ───────── 6. 쇼핑과 계산 ─────────
    {
      id: 'en-u06-01',
      unit: 'en-u06',
      t: "I'm just looking, thanks.",
      pron: '아임 저슷 루킹, 땡스',
      ko: '그냥 구경하는 중이에요, 감사해요.',
      blank: 'just looking',
      note: '점원이 “도와드릴까요?(Can I help you?)”라고 물을 때, 아직 살 게 없다면 웃으며 이렇게 답하면 돼요.'
    },
    {
      id: 'en-u06-02',
      unit: 'en-u06',
      t: 'How much is this?',
      pron: '하우 머치 이즈 디스?',
      ko: '이거 얼마예요?',
      blank: 'How much',
      note: '가격을 물을 때 써요. 여러 개를 가리킬 땐 How much are these? 라고 해요.'
    },
    {
      id: 'en-u06-03',
      unit: 'en-u06',
      t: 'Do you have this in black?',
      pron: '두 유 해브 디스 인 블랙?',
      ko: '이거 검은색도 있어요?',
      blank: 'in black',
      note: '색이나 사이즈를 바꿔 물을 수 있어요: Do you have this in a large?(이거 라지 있어요?)'
    },
    {
      id: 'en-u06-04',
      unit: 'en-u06',
      t: "I'll take this one.",
      pron: '아일 테익 디스 원',
      ko: '이걸로 할게요.',
      blank: "I'll take",
      note: '살 물건을 정했을 때 쓰는 “이거 주세요”예요. 두 개면 I’ll take two. 라고 해요.'
    },
    {
      id: 'en-u06-05',
      unit: 'en-u06',
      t: 'Can I pay with a card?',
      pron: '캐나이 페이 위더 카드?',
      ko: '카드로 계산해도 돼요?',
      blank: 'pay with a card',
      note: '카드 결제가 되는지 물어요. Do you take cards? 도 같은 뜻이고, 현금은 cash라고 해요.'
    },

    // ───────── 7. 대중교통과 택시 ─────────
    {
      id: 'en-u07-01',
      unit: 'en-u07',
      t: 'Does this bus go downtown?',
      pron: '더즈 디스 버스 고우 다운타운?',
      ko: '이 버스 시내 가요?',
      blank: 'Does this bus go',
      note: '타기 전에 기사님께 확인하는 말이에요. downtown 자리에 목적지를 넣어요: Does this bus go to the airport?'
    },
    {
      id: 'en-u07-02',
      unit: 'en-u07',
      t: 'How much is the fare?',
      pron: '하우 머치 이즈 더 페어?',
      ko: '요금이 얼마예요?',
      blank: 'the fare',
      note: '버스·지하철·택시 요금을 물을 때 써요. 쇼핑에서 배운 How much ~? 패턴 그대로예요.'
    },
    {
      id: 'en-u07-03',
      unit: 'en-u07',
      t: 'Could you tell me when to get off?',
      pron: '쿠쥬 텔 미 웬 투 게로프?',
      ko: '내릴 때 알려 주시겠어요?',
      blank: 'get off',
      note: '처음 가는 길이라 어디서 내릴지 모를 때 기사님께 부탁해요. Could you ~? 는 공손하게 부탁하는 패턴이에요.'
    },
    {
      id: 'en-u07-04',
      unit: 'en-u07',
      t: 'To this address, please.',
      pron: '투 디스 어드레스, 플리즈',
      ko: '이 주소로 가 주세요.',
      blank: 'this address',
      note: '택시 기사님이 “어디로 가세요?(Where to?)”라고 물으면 주소를 보여 주며 말해요. 장소 이름을 넣어도 돼요: To City Hall, please.'
    },
    {
      id: 'en-u07-05',
      unit: 'en-u07',
      t: 'Can you stop here, please?',
      pron: '캐뉴 스탑 히어, 플리즈?',
      ko: '여기서 세워 주시겠어요?',
      blank: 'stop here',
      note: '택시에서 내리고 싶은 곳에 왔을 때 써요. Right here is fine.(여기면 돼요)이라고 해도 자연스러워요.'
    },

    // ───────── 8. 호텔에서 ─────────
    {
      id: 'en-u08-01',
      unit: 'en-u08',
      t: "I'd like to check in.",
      pron: '아이드 라익 투 체킨',
      ko: '체크인하려고요.',
      blank: 'check in',
      note: '호텔 프런트에서 처음 하는 말이에요. 나갈 때는 I’d like to check out. 이라고 해요.'
    },
    {
      id: 'en-u08-02',
      unit: 'en-u08',
      t: 'I have a reservation.',
      pron: '아이 해버 레저베이션',
      ko: '예약했어요.',
      blank: 'reservation',
      note: '예약이 되어 있다고 말할 때 써요. 식당에서도 똑같이 쓸 수 있어요.'
    },
    {
      id: 'en-u08-03',
      unit: 'en-u08',
      t: "It's under Kim.",
      pron: '잇츠 언더 킴',
      ko: '김 이름으로 예약했어요.',
      blank: 'under Kim',
      note: '“성함이 어떻게 되세요?(What’s the name?)”라고 물으면 under 뒤에 예약한 이름을 넣어 답해요.'
    },
    {
      id: 'en-u08-04',
      unit: 'en-u08',
      t: 'Can I leave my bags here?',
      pron: '캐나이 리브 마이 백즈 히어?',
      ko: '여기 짐 좀 맡겨도 될까요?',
      blank: 'leave my bags',
      note: '체크인 전이나 체크아웃 후에 짐을 맡기고 싶을 때 써요. 대부분의 호텔이 무료로 맡아 줘요.'
    },
    {
      id: 'en-u08-05',
      unit: 'en-u08',
      t: 'What time is checkout?',
      pron: '왓 타임 이즈 체카웃?',
      ko: '체크아웃은 몇 시예요?',
      blank: 'What time',
      note: 'What time is ~? 로 시간을 물어요: What time is breakfast?(아침 식사는 몇 시예요?)'
    },

    // ───────── 9. 취미 이야기 ─────────
    {
      id: 'en-u09-01',
      unit: 'en-u09',
      t: 'What do you do for fun?',
      pron: '왓 두 유 두 포 펀?',
      ko: '취미가 뭐예요?',
      blank: 'for fun',
      note: '취미를 물을 때 원어민이 가장 흔히 쓰는 말이에요. What’s your hobby? 보다 훨씬 자연스러워요.'
    },
    {
      id: 'en-u09-02',
      unit: 'en-u09',
      t: 'I like watching movies.',
      pron: '아이 라익 와칭 무비즈',
      ko: '저는 영화 보는 걸 좋아해요.',
      blank: 'I like',
      note: 'I like 뒤에 -ing를 붙여 좋아하는 활동을 말해요: I like cooking.(요리하는 걸 좋아해요)'
    },
    {
      id: 'en-u09-03',
      unit: 'en-u09',
      t: "I'm really into hiking.",
      pron: '아임 리얼리 인투 하이킹',
      ko: '요즘 등산에 푹 빠졌어요.',
      blank: 'really into',
      note: 'be into ~ 는 “~에 빠져 있다”는 뜻으로 일상에서 아주 많이 써요. I like보다 더 좋아한다는 느낌이에요.'
    },
    {
      id: 'en-u09-04',
      unit: 'en-u09',
      t: 'That sounds fun!',
      pron: '댓 사운즈 펀!',
      ko: '재밌겠네요!',
      blank: 'sounds fun',
      note: '상대 이야기에 맞장구칠 때 써요. fun 자리에 great, nice, interesting을 넣어 바꿔 쓸 수 있어요.'
    },
    {
      id: 'en-u09-05',
      unit: 'en-u09',
      t: "Let's go hiking together sometime!",
      pron: '렛츠 고우 하이킹 투게더 썸타임!',
      ko: '언제 같이 등산 가요!',
      blank: "Let's go",
      note: 'Let’s ~ 는 같이 하자고 제안하는 말이에요. 끝에 sometime을 붙이면 “언제 한번” 하는 부담 없는 느낌이 돼요.'
    },

    // ───────── 10. 약속 잡기 ─────────
    {
      id: 'en-u10-01',
      unit: 'en-u10',
      t: 'Are you free this Saturday?',
      pron: '아 유 프리 디스 쌔러데이?',
      ko: '이번 토요일에 시간 돼요?',
      blank: 'Are you free',
      note: '상대가 시간이 되는지 물어요. this Saturday 자리에 tonight, tomorrow 같은 말을 넣어요.'
    },
    {
      id: 'en-u10-02',
      unit: 'en-u10',
      t: 'What time works for you?',
      pron: '왓 타임 웍스 포 유?',
      ko: '몇 시가 괜찮아요?',
      blank: 'works for you',
      note: '상대에게 편한 시간을 묻는 배려 있는 표현이에요. 요일을 물을 땐 What day works for you?'
    },
    {
      id: 'en-u10-03',
      unit: 'en-u10',
      t: "How about one o'clock?",
      pron: '하우 어바웃 원 어클락?',
      ko: '1시 어때요?',
      blank: 'How about',
      note: 'How about ~? 로 시간, 장소, 메뉴 무엇이든 제안할 수 있어요: How about pizza?(피자 어때요?)'
    },
    {
      id: 'en-u10-04',
      unit: 'en-u10',
      t: 'Where should we meet?',
      pron: '웨어 슈드 위 밋?',
      ko: '어디서 만날까요?',
      blank: 'Where should we',
      note: 'should we ~? 는 “우리 ~할까요?”라는 뜻이에요. What should we eat?(뭐 먹을까요?)처럼 바꿔 써요.'
    },
    {
      id: 'en-u10-05',
      unit: 'en-u10',
      t: "Let's meet at the station.",
      pron: '렛츠 밋 앳 더 스테이션',
      ko: '역에서 만나요.',
      blank: "Let's meet at",
      note: 'Let’s meet at 뒤에 장소나 시간을 넣어요: Let’s meet at six.(6시에 만나요)'
    },

    // ───────── 11. 날씨와 안부 ─────────
    {
      id: 'en-u11-01',
      unit: 'en-u11',
      t: "It's so hot today.",
      pron: '잇츠 쏘 핫 투데이',
      ko: '오늘 너무 덥네요.',
      blank: 'so hot',
      note: '날씨 이야기는 누구와도 가볍게 대화를 시작하기 좋아요. 추운 날엔 It’s so cold today.'
    },
    {
      id: 'en-u11-02',
      unit: 'en-u11',
      t: 'How have you been?',
      pron: '하우 해뷰 빈?',
      ko: '그동안 잘 지냈어요?',
      blank: 'have you been',
      note: '오랜만에 만난 사람에게 묻는 안부예요. 대답은 Pretty good!(잘 지냈어요!)처럼 짧게 하면 돼요.'
    },
    {
      id: 'en-u11-03',
      unit: 'en-u11',
      t: 'Long time no see!',
      pron: '롱 타임 노우 씨!',
      ko: '오랜만이에요!',
      blank: 'Long time',
      note: '오랜만에 만나 반가울 때 하는 말이에요. 친구나 편한 사이에서 많이 써요.'
    },
    {
      id: 'en-u11-04',
      unit: 'en-u11',
      t: 'How was your weekend?',
      pron: '하우 워즈 유어 위켄드?',
      ko: '주말 잘 보냈어요?',
      blank: 'How was',
      note: '월요일에 동료나 친구에게 자주 하는 질문이에요. How was ~? 로 지난 일을 물어요: How was your trip?'
    },
    {
      id: 'en-u11-05',
      unit: 'en-u11',
      t: 'I just stayed home and relaxed.',
      pron: '아이 저슷 스테이드 홈 앤 릴랙스트',
      ko: '그냥 집에서 쉬었어요.',
      blank: 'stayed home',
      note: '주말에 뭐 했는지에 대한 쉬운 대답이에요. 지난 일은 stayed, went처럼 과거형으로 말해요: I went hiking.'
    },

    // ───────── 12. 도움이 필요할 때 ─────────
    {
      id: 'en-u12-01',
      unit: 'en-u12',
      t: 'Sorry, could you say that again?',
      pron: '쏘리, 쿠쥬 쎄이 댓 어겐?',
      ko: '죄송한데, 다시 한번 말해 주시겠어요?',
      blank: 'say that again',
      note: '못 알아들었을 때 가장 많이 쓰는 말이에요. 급할 땐 Sorry? 하고 끝을 올려 말해도 통해요.'
    },
    {
      id: 'en-u12-02',
      unit: 'en-u12',
      t: 'Could you speak a little slower?',
      pron: '쿠쥬 스픽 어 리틀 슬로워?',
      ko: '조금만 천천히 말해 주시겠어요?',
      blank: 'a little slower',
      note: '말이 너무 빠를 때 부탁해요. 앞에 Sorry, 를 붙이면 더 부드럽게 들려요.'
    },
    {
      id: 'en-u12-03',
      unit: 'en-u12',
      t: "I'm sorry, I don't understand.",
      pron: '아임 쏘리, 아이 돈 언더스탠드',
      ko: '죄송해요, 이해를 못 했어요.',
      blank: "don't understand",
      note: '모를 땐 솔직하게 말하는 게 가장 좋아요. 이어서 Could you say that again? 이라고 부탁해 보세요.'
    },
    {
      id: 'en-u12-04',
      unit: 'en-u12',
      t: 'Excuse me, could you help me?',
      pron: '익스큐즈 미, 쿠쥬 헬프 미?',
      ko: '실례지만, 좀 도와주시겠어요?',
      blank: 'help me',
      note: '먼저 Excuse me로 말을 걸고 부탁해요. 정말 급한 상황이면 Please help me! 라고 해요.'
    },
    {
      id: 'en-u12-05',
      unit: 'en-u12',
      t: 'Could you write it down?',
      pron: '쿠쥬 라이릿 다운?',
      ko: '적어 주시겠어요?',
      blank: 'write it down',
      note: '숫자, 이름, 주소처럼 알아듣기 어려운 건 적어 달라고 하면 확실해요. 휴대폰 메모장을 내밀며 말해도 좋아요.'
    }
  ]
};
