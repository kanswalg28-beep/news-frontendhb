function classifyRegion(title, description, rawContent, sourceName, urlText) {
    const titleText = (title || "").toLowerCase();
    const descText = (description || "").toLowerCase();
    const contentText = (rawContent || "").toLowerCase();
    const srcNameText = (sourceName || "").toLowerCase();
    const urlStr = (urlText || "").toLowerCase();

    const combinedText = `${titleText} ${descText} ${contentText} ${srcNameText} ${urlStr}`;

    // India indicators
    const indiaKeywords = [
        "india", "indian", "delhi", "mumbai", "bengaluru", "bangalore", "chennai", "kolkata", "hyderabad", "pune", "ahmedabad", "lucknow", "varanasi", "kerala", "goa", "gujarat", "punjab", "sikh",
        "modi", "bjp", "congress", "gandhi", "amit shah", "kejriwal", "rahul gandhi", "joseph vijay", "tvk", "isro", "rupee", "bollywood", "virat kohli", "dhoni", "rohit sharma", "ipl", "bcci"
    ];

    // UK/Britain indicators
    const ukKeywords = [
        "uk", "united kingdom", "britain", "british", "england", "english", "london", "scotland", "scottish", "wales", "welsh", "northern ireland", "londoner",
        "sunak", "starmer", "downing street", "keir starmer", "rishi sunak", "boris johnson", "westminster", "buckingham", "whitehall", "nhs", "pound", "sterling", "£",
        "king charles", "queen elizabeth", "heathrow", "gatwick", "manchester", "birmingham", "leeds", "glasgow", "edinburgh", "cardiff", "belfast"
    ];

    // Berkshire Local indicators
    const berkshireKeywords = [
        "berkshire", "reading", "slough", "maidenhead", "windsor", "newbury", "bracknell", "wokingham", "earley", "woodley", "twenty", "crowthorne", "sandhurst",
        "thames valley", "m4 corridor", "royal borough", "legoland", "microsoft reading", "oracle reading", "berkshire county", "west berkshire"
    ];

    let indiaCount = 0;
    indiaKeywords.forEach(kw => {
        const regex = new RegExp("\\b" + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "g");
        const matches = combinedText.match(regex);
        if (matches) indiaCount += matches.length;
    });

    let ukCount = 0;
    ukKeywords.forEach(kw => {
        const regex = new RegExp("\\b" + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "g");
        const matches = combinedText.match(regex);
        if (matches) ukCount += matches.length;
    });

    let berkshireCount = 0;
    berkshireKeywords.forEach(kw => {
        const regex = new RegExp("\\b" + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "g");
        const matches = combinedText.match(regex);
        if (matches) berkshireCount += matches.length;
    });

    // Domain and source specific weights
    if (urlStr.includes(".in/") || urlStr.endsWith(".in") || urlStr.includes(".co.in")) indiaCount += 5;
    if (urlStr.includes(".co.uk") || urlStr.includes(".org.uk") || urlStr.includes(".gov.uk") || urlStr.includes("bbc.co.uk")) ukCount += 5;
    if (urlStr.includes("berkshire") || urlStr.includes("reading") || urlStr.includes("windsor")) berkshireCount += 5;

    const indianSources = ["times of india", "the hindu", "indian express", "hindustantimes", "livemint", "moneycontrol", "ndtv", "indiatoday", "news18", "new indian express", "timesofindia"];
    const ukSources = ["bbc", "the guardian", "telegraph", "independent", "daily mail", "mirror", "sky news", "bbc news"];

    indianSources.forEach(src => {
        if (srcNameText.includes(src) || urlStr.includes(src.replace(/\s+/g, ""))) indiaCount += 3;
    });

    ukSources.forEach(src => {
        if (srcNameText.includes(src) || urlStr.includes(src.replace(/\s+/g, ""))) ukCount += 3;
    });

    const berkshireSources = ["reading chronicle", "berkshire live", "getreading", "windsor express", "newbury today", "the bracknell news", "wokingham paper"];
    berkshireSources.forEach(src => {
        if (srcNameText.includes(src) || urlStr.includes(src.replace(/\s+/g, ""))) berkshireCount += 3;
    });

    if (indiaCount > 0 && indiaCount >= ukCount && indiaCount >= berkshireCount) {
        return "indian";
    } else if (ukCount > 0 && ukCount > indiaCount && ukCount >= berkshireCount) {
        return "uk";
    } else if (berkshireCount > 0 && berkshireCount > indiaCount && berkshireCount > ukCount) {
        return "berkshire";
    } else {
        return "world";
    }
}