import type { Locale } from "@/lib/i18n";

export type TutorialSectionId =
  | "goal"
  | "setup"
  | "board"
  | "sectors"
  | "turn"
  | "company"
  | "etf"
  | "news"
  | "pr"
  | "start"
  | "weekend"
  | "tax"
  | "sec"
  | "trade"
  | "win";

type SectionCopy = {
  id: TutorialSectionId;
  nav: string;
  title: string;
  body: string[];
};

type TutorialCopy = {
  title: string;
  lead: string;
  back: string;
  play: string;
  cardHint: string;
  faceFront: string;
  faceBack: string;
  labels: {
    company: string;
    etf: string;
    newsBull: string;
    newsBear: string;
    pr: string;
    weekend: string;
    incomeTax: string;
    wealthTax: string;
    gotoSec: string;
    sec: string;
  };
  sections: SectionCopy[];
};

const en: TutorialCopy = {
  title: "How to play",
  lead: "You manage an investment fund on a stock market board. Buy and sell company shares and ETF units while keeping enough cash to cover mandatory payments. The last fund that can still meet its obligations wins, and there is no turn limit.",
  back: "Back",
  play: "Open a table",
  cardHint:
    "The board and card examples below come from the game. When two sides of a card are shown, read them from left to right on a wide screen or from top to bottom on a narrow screen. The captions identify each side.",
  faceFront: "Front",
  faceBack: "Back",
  labels: {
    company: "Company card",
    etf: "ETF card",
    newsBull: "Bull Market News",
    newsBear: "Bear Market News",
    pr: "Price Reaction",
    weekend: "Weekend",
    incomeTax: "Income Tax",
    wealthTax: "Wealth Tax",
    gotoSec: "Go to SEC Investigation",
    sec: "SEC Investigation",
  },
  sections: [
    {
      id: "goal",
      nav: "Goal",
      title: "Goal",
      body: [
        "Each fund starts with 5,000 M$ and a token on START, with all eight sector markers set to 0. If your fund cannot cover a mandatory payment after selling all holdings it is allowed to sell, it goes bankrupt and is eliminated.",
      ],
    },
    {
      id: "setup",
      nav: "Setup",
      title: "Setup",
      body: [
        "Take a seat in the lobby, choose your fund identity, and mark yourself as ready before the match begins. When the match starts, all tokens are placed on START, but this initial placement does not trigger START settlement.",
        "You can also join as a spectator and watch the entire match without taking a seat. If you leave your seat during the match, your fund continues playing automatically.",
      ],
    },
    {
      id: "board",
      nav: "Board",
      title: "The board",
      body: [
        "The board is a square loop with company tiles, ETF tiles, Market News spaces, tax spaces, and four corners: START, Weekend, SEC Investigation, and Go to SEC Investigation. Only company and ETF tiles open the trading desk. All other tiles resolve their own rules without allowing a voluntary trade.",
      ],
    },
    {
      id: "sectors",
      nav: "Sectors",
      title: "Sector levels",
      body: [
        "The board has eight sector tracks, each with a marker that can move from -5 to +5. A company's current share price and revenue per share depend on the level of its sector. An ETF unit is priced by adding the values of its sector components, using the current level of each sector separately. Market News and Price Reaction cards can move these markers.",
      ],
    },
    {
      id: "turn",
      nav: "Your Turn",
      title: "Your turn",
      body: [
        "Roll two dice, move the number of spaces shown by their total, and resolve the tile you land on. If that tile opens the trading desk, you may place one voluntary order after resolving it. Rolling doubles does not give you an extra turn.",
      ],
    },
    {
      id: "company",
      nav: "Company",
      title: "Company cards",
      body: [
        "The front of a company card shows its sector, name, ticker, logo, base price per share, visit fee per share, and share price at each sector level. The highlighted row shows the current level. The back lists revenue per share at each level, which is used to calculate the company's settlement at START.",
        "When you land on a company tile, pay a visit fee to each other fund that owns shares in that company. The amount each fund receives is the visit fee per share multiplied by the number of shares it holds. You do not pay a fee on your own shares. After paying, you may buy or sell 1 to 10 shares of that company.",
      ],
    },
    {
      id: "etf",
      nav: "ETF",
      title: "ETF cards",
      body: [
        "An ETF holds a basket of sectors, shown by the colored chips on its card. To calculate the price of one ETF unit, look up each component's value at its own sector's current level and add those values together. The sectors in the basket do not have to be at the same level.",
        "Landing on an ETF does not trigger a visit fee. ETF orders execute at the current unit price without drawing a Price Reaction card or paying an order fee.",
      ],
    },
    {
      id: "news",
      nav: "Market News",
      title: "Market News cards",
      body: [
        "When you land on a Market News space, draw one card from the 100-card Market News deck. Bull cards raise the levels of the sectors listed on the card, while Bear cards lower them. Sector levels cannot go below -5 or above +5, and the changes take effect immediately for every fund.",
        "Bull example: AI Investment Boom. Businesses increase spending on AI and data centers, raising Technology (TE) by 2 levels, Communication (CM) by 1 level, and Industrials (IN) by 1 level.",
        "Bear example: Banking Crisis. Concerns about bank liquidity lead lenders to tighten credit, lowering Financials (FI) by 2 levels, Industrials (IN) by 1 level, and Consumer Discretionary (CD) by 1 level.",
      ],
    },
    {
      id: "pr",
      nav: "Price Reaction",
      title: "Price Reaction cards",
      body: [
        "Whenever you place a company order, draw from the 100-card Price Reaction deck until you find the first card that matches both the order type and the number of shares. Apply the sector changes shown on that card before executing the entire order at the updated share price. Company orders also incur a fee paid to the bank, while ETF orders do not use this deck.",
        "Sample card: Risk-On Rally. This card applies to buy orders for 2 to 4 shares or more than 6 shares, and to sell orders for 2 to 4 shares or more than 5 shares.",
      ],
    },
    {
      id: "start",
      nav: "START",
      title: "START",
      body: [
        "When you pass or land on START, first pay the bank 10% of your current cash balance, rounded down to the nearest whole M$. Then calculate the revenue minus operating costs for all company shares you hold and settle the total with the bank in one payment. The bank pays you if the total is positive, and you pay the bank if it is negative.",
        "ETF holdings are not included in START settlement, and the START tile does not open the trading desk.",
      ],
    },
    {
      id: "weekend",
      nav: "Weekend",
      title: "Weekend",
      body: [
        "Weekend is a rest space where you do not pay a fee, draw a Market News card, or make a forced move. The trading desk stays closed.",
      ],
    },
    {
      id: "tax",
      nav: "Tax",
      title: "Tax",
      body: [
        "When you land on Income Tax, pay the bank 120 M$. When you land on Wealth Tax, pay the bank 250 M$. If you do not have enough cash, sell eligible holdings to cover the bill. If you still cannot pay after selling all holdings you are allowed to sell, your fund goes bankrupt. Neither tax tile opens the trading desk.",
      ],
    },
    {
      id: "sec",
      nav: "SEC",
      title: "SEC Investigation",
      body: [
        "If you land on Go to SEC Investigation, move directly to SEC Investigation without settling at START or trading that turn. If you land on SEC Investigation through normal movement, you are only visiting and do not pay a fine.",
        "While under investigation, you can pay 100 M$ to leave or try to roll doubles. If you roll doubles, leave and move according to that roll. If all three attempts fail, pay the fine and move according to your third roll.",
      ],
    },
    {
      id: "trade",
      nav: "Trading",
      title: "Buying and selling",
      body: [
        "When the trading desk is open, you may place one voluntary buy or sell order per turn. Each order covers a single ticker and can include 1 to 10 company shares or ETF units.",
        "Before drawing a Price Reaction card for a company order, you must have enough cash to cover the order under the least favorable possible outcome. Selling holdings to cover a mandatory payment is called liquidation and does not count toward your voluntary order limit.",
      ],
    },
    {
      id: "win",
      nav: "Winning",
      title: "Winning",
      body: [
        "Net worth helps you track your position, but it does not decide the winner. A bankrupt fund is eliminated, and the match ends as soon as only one solvent fund remains. Since there is no turn limit, keeping enough cash to cover unexpected payments is just as important as timing your trades.",
      ],
    },
  ],
};

const vi: TutorialCopy = {
  title: "Hướng dẫn chơi",
  lead: "Bạn điều hành một quỹ đầu tư trên bàn chơi mô phỏng thị trường chứng khoán. Hãy mua bán cổ phiếu và chứng chỉ quỹ ETF, đồng thời giữ đủ tiền mặt để chi trả các khoản bắt buộc. Quỹ cuối cùng còn khả năng thanh toán sẽ thắng, và trận đấu không giới hạn số lượt.",
  back: "Quay lại",
  play: "Vào bàn chơi",
  cardHint:
    "Bàn chơi và các thẻ minh họa dưới đây đều được lấy từ trò chơi. Khi cả hai mặt thẻ cùng xuất hiện, bạn có thể xem từ trái sang phải trên màn hình rộng hoặc từ trên xuống dưới trên màn hình hẹp. Chú thích cho biết đâu là mặt trước và đâu là mặt sau.",
  faceFront: "Mặt trước",
  faceBack: "Mặt sau",
  labels: {
    company: "Thẻ công ty",
    etf: "Thẻ ETF",
    newsBull: "Tin thị trường Bull",
    newsBear: "Tin thị trường Bear",
    pr: "Phản ứng giá",
    weekend: "Cuối tuần",
    incomeTax: "Thuế thu nhập",
    wealthTax: "Thuế tài sản",
    gotoSec: "Đến ô Điều tra SEC",
    sec: "Điều tra SEC",
  },
  sections: [
    {
      id: "goal",
      nav: "Mục tiêu",
      title: "Mục tiêu",
      body: [
        "Mỗi quỹ bắt đầu với 5.000 M$ và một quân cờ tại ô START, còn cả tám chỉ số ngành đều bắt đầu ở mức 0. Nếu đã bán hết tài sản được phép bán mà vẫn không đủ tiền chi trả một khoản bắt buộc, quỹ của bạn sẽ phá sản và bị loại khỏi trận.",
      ],
    },
    {
      id: "setup",
      nav: "Chuẩn bị",
      title: "Chuẩn bị",
      body: [
        "Trong phòng chờ, bạn chọn chỗ chơi, chọn quỹ đại diện rồi bấm Sẵn sàng. Khi trận đấu bắt đầu, tất cả quân cờ được đặt tại START, nhưng lần đặt quân này không kích hoạt quyết toán tại ô START.",
        "Bạn cũng có thể vào phòng với tư cách khán giả để theo dõi toàn bộ trận đấu mà không cần chọn chỗ chơi. Nếu bạn rời chỗ giữa trận, quỹ của bạn sẽ tiếp tục chơi tự động.",
      ],
    },
    {
      id: "board",
      nav: "Bàn chơi",
      title: "Bàn chơi",
      body: [
        "Bàn chơi là một vòng hình vuông gồm các ô công ty, ETF, Tin thị trường, Thuế và bốn ô góc: START, Cuối tuần, Điều tra SEC và Đến ô Điều tra SEC. Chỉ ô công ty và ô ETF mở bảng giao dịch. Các ô còn lại áp dụng quy tắc riêng và không cho phép đặt lệnh tự nguyện.",
      ],
    },
    {
      id: "sectors",
      nav: "Chỉ số ngành",
      title: "Chỉ số ngành",
      body: [
        "Bàn chơi có tám thang chỉ số ngành, mỗi chỉ số có thể thay đổi từ -5 đến +5. Chỉ số của một ngành quyết định giá và doanh thu trên mỗi cổ phiếu của các công ty thuộc ngành đó. Giá một chứng chỉ ETF bằng tổng giá trị của các cấu phần, trong đó mỗi cấu phần được tính theo chỉ số hiện tại của ngành tương ứng. Thẻ Tin thị trường và thẻ Phản ứng giá có thể làm các chỉ số ngành tăng hoặc giảm.",
      ],
    },
    {
      id: "turn",
      nav: "Lượt chơi",
      title: "Lượt chơi",
      body: [
        "Bạn tung hai viên xúc xắc, di chuyển số ô bằng tổng số điểm vừa tung rồi xử lý ô mình dừng lại. Nếu ô đó mở bảng giao dịch, bạn có thể đặt một lệnh tự nguyện sau khi xử lý xong. Hai viên xúc xắc ra cùng số điểm không cho bạn thêm lượt.",
      ],
    },
    {
      id: "company",
      nav: "Công ty",
      title: "Thẻ công ty",
      body: [
        "Mặt trước thẻ hiển thị ngành, tên công ty, mã cổ phiếu, logo, giá cơ sở trên mỗi cổ phiếu, phí ghé ô trên mỗi cổ phiếu và bảng giá theo từng mức chỉ số ngành. Hàng được tô nổi cho biết mức hiện tại. Mặt sau ghi doanh thu trên mỗi cổ phiếu theo từng mức chỉ số để tính khoản quyết toán của công ty tại START.",
        "Khi dừng ở ô công ty, bạn trả phí ghé ô cho từng quỹ khác đang nắm giữ cổ phiếu của công ty đó. Số tiền mỗi quỹ nhận được bằng phí trên một cổ phiếu nhân với số cổ phiếu quỹ đó đang nắm giữ. Bạn không trả phí cho số cổ phiếu của chính mình. Sau khi thanh toán, bạn có thể mua hoặc bán từ 1 đến 10 cổ phiếu của công ty đó.",
      ],
    },
    {
      id: "etf",
      nav: "ETF",
      title: "Thẻ ETF",
      body: [
        "ETF là một quỹ gồm nhiều cấu phần theo ngành, được thể hiện bằng các ký hiệu màu trên thẻ. Để tính giá một chứng chỉ ETF, bạn tra giá trị từng cấu phần theo chỉ số hiện tại của ngành tương ứng rồi cộng các giá trị lại. Các ngành trong cùng một ETF không nhất thiết ở cùng một mức.",
        "Khi dừng tại ô ETF, bạn không phải trả phí ghé ô. Lệnh ETF được khớp theo giá hiện tại của chứng chỉ quỹ mà không cần rút thẻ Phản ứng giá hay trả phí giao dịch.",
      ],
    },
    {
      id: "news",
      nav: "Tin thị trường",
      title: "Thẻ Tin thị trường",
      body: [
        "Khi dừng tại ô Tin thị trường, bạn rút một thẻ từ bộ 100 thẻ Tin thị trường. Thẻ Bull làm tăng chỉ số của các ngành được ghi trên thẻ, còn thẻ Bear làm giảm các chỉ số đó. Mọi chỉ số đều nằm trong khoảng -5 đến +5, và thay đổi có hiệu lực ngay với tất cả các quỹ.",
        "Ví dụ thẻ Bull: Bùng nổ đầu tư vào AI. Doanh nghiệp tăng chi tiêu cho AI và trung tâm dữ liệu, khiến chỉ số ngành Công nghệ (TE) tăng 2 mức, Truyền thông (CM) tăng 1 mức và Công nghiệp (IN) tăng 1 mức.",
        "Ví dụ thẻ Bear: Khủng hoảng ngân hàng. Lo ngại về thanh khoản khiến các bên cho vay siết tín dụng, làm chỉ số ngành Tài chính (FI) giảm 2 mức, Công nghiệp (IN) giảm 1 mức và Hàng tiêu dùng không thiết yếu (CD) giảm 1 mức.",
      ],
    },
    {
      id: "pr",
      nav: "Phản ứng giá",
      title: "Thẻ Phản ứng giá",
      body: [
        "Khi đặt lệnh cổ phiếu, bạn rút từ bộ 100 thẻ Phản ứng giá cho đến khi gặp thẻ đầu tiên phù hợp với cả loại lệnh mua hoặc bán và số lượng cổ phiếu. Bạn điều chỉnh các chỉ số ngành theo thẻ trước khi khớp toàn bộ lệnh theo giá cổ phiếu mới. Lệnh cổ phiếu có thêm khoản phí trả cho ngân hàng, còn lệnh ETF không sử dụng bộ thẻ này.",
        "Thẻ mẫu: Đợt tăng giá khi thị trường ưa rủi ro (Risk-On Rally). Thẻ áp dụng cho lệnh mua từ 2 đến 4 cổ phiếu hoặc trên 6 cổ phiếu, và cho lệnh bán từ 2 đến 4 cổ phiếu hoặc trên 5 cổ phiếu.",
      ],
    },
    {
      id: "start",
      nav: "START",
      title: "Ô START",
      body: [
        "Khi đi qua hoặc dừng tại START, trước tiên bạn nộp cho ngân hàng khoản thuế bằng 10% số dư tiền mặt hiện tại, làm tròn xuống đến đơn vị M$ nguyên. Sau đó, bạn lấy doanh thu trừ chi phí vận hành cho toàn bộ cổ phiếu đang nắm giữ rồi quyết toán tổng chênh lệch với ngân hàng một lần. Nếu tổng dương, ngân hàng trả tiền cho bạn. Nếu tổng âm, bạn trả tiền cho ngân hàng.",
        "Chứng chỉ ETF không được tính vào khoản quyết toán tại START, và ô này không mở bảng giao dịch.",
      ],
    },
    {
      id: "weekend",
      nav: "Cuối tuần",
      title: "Ô Cuối tuần",
      body: [
        "Cuối tuần là ô nghỉ. Khi dừng tại đây, bạn không phải trả phí, không rút thẻ Tin thị trường và không bị buộc di chuyển. Bảng giao dịch vẫn đóng.",
      ],
    },
    {
      id: "tax",
      nav: "Thuế",
      title: "Ô Thuế",
      body: [
        "Khi dừng tại ô Thuế thu nhập, bạn nộp 120 M$ cho ngân hàng. Khi dừng tại ô Thuế tài sản, bạn nộp 250 M$. Nếu thiếu tiền mặt, bạn phải bán tài sản được phép bán để chi trả. Nếu đã bán hết số tài sản đó mà vẫn không đủ tiền, quỹ của bạn sẽ phá sản. Cả hai ô thuế đều không mở bảng giao dịch.",
      ],
    },
    {
      id: "sec",
      nav: "SEC",
      title: "Ô Điều tra SEC",
      body: [
        "Nếu dừng tại ô Đến ô Điều tra SEC, bạn di chuyển thẳng đến Điều tra SEC, không quyết toán tại START và không giao dịch trong lượt đó. Nếu dừng tại ô Điều tra SEC sau khi di chuyển bình thường, bạn chỉ ghé qua và không phải nộp phạt.",
        "Nếu đang bị điều tra, bạn có thể nộp phạt 100 M$ để rời ô hoặc thử tung hai viên xúc xắc sao cho ra cùng số điểm. Nếu tung được, bạn rời ô và di chuyển theo tổng điểm vừa tung. Nếu cả ba lần đều không thành công, bạn nộp phạt rồi di chuyển theo kết quả của lần tung thứ ba.",
      ],
    },
    {
      id: "trade",
      nav: "Giao dịch",
      title: "Mua và bán",
      body: [
        "Khi bảng giao dịch mở, bạn có thể đặt một lệnh mua hoặc bán tự nguyện trong lượt đó. Mỗi lệnh chỉ áp dụng cho một mã và có số lượng từ 1 đến 10 cổ phiếu hoặc chứng chỉ ETF.",
        "Trước khi rút thẻ Phản ứng giá cho một lệnh cổ phiếu, bạn phải có đủ tiền mặt để thực hiện lệnh ngay cả trong trường hợp bất lợi nhất. Việc bán tài sản để chi trả một khoản bắt buộc được gọi là thanh lý và không tính vào giới hạn lệnh tự nguyện của lượt.",
      ],
    },
    {
      id: "win",
      nav: "Chiến thắng",
      title: "Điều kiện chiến thắng",
      body: [
        "Giá trị tài sản ròng giúp bạn theo dõi vị thế của quỹ, nhưng không quyết định người thắng. Quỹ phá sản bị loại và trận đấu kết thúc ngay khi chỉ còn một quỹ có khả năng thanh toán. Vì không có giới hạn lượt chơi, giữ đủ tiền mặt để chi trả các khoản phát sinh cũng quan trọng như chọn đúng thời điểm giao dịch.",
      ],
    },
  ],
};

export function tutorialCopy(locale: Locale): TutorialCopy {
  return locale === "vi" ? vi : en;
}
