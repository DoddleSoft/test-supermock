export const listeningModuleData = {
  module_id: "listening-cambridge-8-test-1",
  title: "Cambridge IELTS 8 - Listening Test 1",
  module_type: "listening",
  center_id: "cambridge",
  order_index: 1,
  total_questions: 40,
  duration_minutes: 30,
  sections: [
    // =========================================================================
    // SECTION 1: HIRING A PUBLIC ROOM (Existing)
    // =========================================================================
    {
      section_id: "section-1",
      title: "Section 1",
      audio_path: "/section1.mpeg",
      instruction: "You should spend about 7-8 minutes on this section.",

      render_blocks: [
        { type: "header", content: "Questions 1-10" },
        {
          type: "instruction",
          content:
            "Complete the notes below.\nWrite ONE WORD AND/OR A NUMBER for each answer.",
        },
        { type: "title", content: "HIRING A PUBLIC ROOM" },
        { type: "box", content: "Example\n• the Main Hall – seats 200" },
        { type: "subtitle", content: "Room and cost" },
        { type: "text", content: "• the {{1}blanks} Room – seats 100" },
        {
          type: "text",
          content: "• Cost of Main Hall for Saturday evening: £{{2}blanks}",
        },
        {
          type: "text",
          content: "  + £250 deposit ({{3}blanks} payment is required)",
        },
        {
          type: "text",
          content:
            "• Cost includes use of tables and chairs and also {{4}blanks}",
        },
        {
          type: "text",
          content: "• Additional charge for use of the kitchen: £25",
        },
        { type: "subtitle", content: "Before the event" },
        { type: "text", content: "• Will need a {{5}blanks} licence" },
        {
          type: "text",
          content:
            "• Need to contact caretaker (Mr Evans) in advance to arrange {{6}blanks}",
        },
        { type: "subtitle", content: "During the event" },
        { type: "text", content: "• The building is no smoking" },
        {
          type: "text",
          content: "• The band should use the {{7}blanks} door at the back",
        },
        {
          type: "text",
          content: "• Don’t touch the system that controls the volume",
        },
        { type: "text", content: "• For microphones, contact the caretaker" },
        { type: "subtitle", content: "After the event" },
        {
          type: "text",
          content: "• Need to know the {{8}blanks} for the cleaning cupboard",
        },
        {
          type: "text",
          content:
            "• The {{9}blanks} must be washed and rubbish placed in black bags",
        },
        { type: "text", content: "• All {{10}blanks} must be taken down" },
        { type: "text", content: "• Chairs and tables must be piled up" },
      ],
      questions: {
        "1": { answer: "Charlton" },
        "2": { answer: "115" },
        "3": { answer: "cash" },
        "4": { answer: "parking" },
        "5": { answer: "music" },
        "6": { answer: "entry" },
        "7": { answer: "stage" },
        "8": { answer: "code" },
        "9": { answer: "floors" },
        "10": { answer: "decorations" },
      },
    },

    // =========================================================================
    // SECTION 2: FIDDY WORKING HERITAGE FARM (New)
    // =========================================================================
    {
      section_id: "section-2",
      title: "Section 2",
      audio_path: "/section2.mpeg",
      instruction: "You should spend about 7-8 minutes on this section.",

      render_blocks: [
        // --- Questions 11-14: Notes Completion ---
        { type: "header", content: "Questions 11-14" },
        {
          type: "instruction",
          content: "Complete the notes below.\nWrite ONE WORD for each answer.",
        },

        { type: "title", content: "Fiddy Working Heritage Farm" },
        { type: "subtitle", content: "Advice about visiting the farm" },

        { type: "text", content: "Visitors should:" },
        { type: "text", content: "• take care not to harm any {{11}blanks}" },
        { type: "text", content: "• not touch any {{12}blanks}" },
        { type: "text", content: "• wear {{13}blanks}" },
        {
          type: "text",
          content:
            "• not bring {{14}blanks} into the farm, with certain exceptions.",
        },

        // --- Questions 15-20: Map Labeling ---
        { type: "header", content: "Questions 15-20" },
        {
          type: "instruction",
          content:
            "Label the map below.\nWrite the correct letter A-I, next to Questions 15-20.",
        },

        // NEW: Image Block type
        {
          type: "image",
          content: "/listening_image.png", // You must save the map image here
          alt: "Map of Fiddy Working Heritage Farm",
        },

        { type: "text", content: "15. Scarecrow {{15}dropdown}" },
        { type: "text", content: "16. Maze {{16}dropdown}" },
        { type: "text", content: "17. Café {{17}dropdown}" },
        { type: "text", content: "18. Black Barn {{18}dropdown}" },
        { type: "text", content: "19. Covered picnic area {{19}dropdown}" },
        { type: "text", content: "20. Fiddy House {{20}dropdown}" },
      ],

      questions: {
        // Notes Completion
        "11": { answer: "animals" },
        "12": { answer: "tools" },
        "13": { answer: "shoes" },
        "14": { answer: "dogs" },

        // Map Labeling (Correct answers based on Cambridge IELTS 8)
        "15": {
          answer: "F",
          options: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        },
        "16": {
          answer: "G",
          options: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        },
        "17": {
          answer: "D",
          options: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        },
        "18": {
          answer: "H",
          options: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        },
        "19": {
          answer: "C",
          options: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        },
        "20": {
          answer: "A",
          options: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        },
      },
    },

    // =========================================================================
    // SECTION 3: Study on Gender in Physics (New)
    // =========================================================================
    {
      section_id: "section-3",
      title: "Section 3",
      audio_path: "/section3.mpeg",
      instruction:
        "You should spend about 7-8 minutes on this section. Choose the correct letter, A, B or C.",
      render_blocks: [
        { type: "header", content: "Questions 21-30" },
        {
          type: "instruction",
          content: "Choose the correct letter, A, B or C.",
        },

        { type: "title", content: "Study on Gender in Physics" },

        {
          type: "text",
          content:
            "{{21}mcq} The students in Akira Miyake’s study were all majoring in",
        },
        {
          type: "text",
          content: "{{22}mcq} The aim of Miyake’s study was to investigate",
        },
        {
          type: "text",
          content:
            "{{23}mcq} The female physics students were wrong to believe that",
        },
        {
          type: "text",
          content: "{{24}mcq} Miyake’s team asked the students to write about",
        },
        {
          type: "text",
          content:
            "{{25}mcq} What was the aim of the writing exercise done by the subjects?",
        },
        {
          type: "text",
          content: "{{26}mcq} What surprised the researchers about the study?",
        },
        {
          type: "text",
          content:
            "{{27}mcq} Greg and Lisa think Miyake’s results could have been affected by",
        },
        {
          type: "text",
          content:
            "{{28}mcq} Greg and Lisa decide that in their own project, they will compare the effects of",
        },
        {
          type: "text",
          content:
            "{{29}mcq} The main finding of Smolinsky’s research was that class teamwork activities",
        },
        {
          type: "text",
          content: "{{30}mcq} What will Lisa and Greg do next?",
        },
      ],

      questions: {
        "21": {
          answer: "C",
          options: [
            { label: "A", text: "physics." },
            { label: "B", text: "psychology or physics." },
            {
              label: "C",
              text: "science, technology, engineering or mathematics.",
            },
          ],
        },
        "22": {
          answer: "B",
          options: [
            { label: "A", text: "what kind of women choose to study physics." },
            {
              label: "B",
              text: "a way of improving women’s performance in physics.",
            },
            {
              label: "C",
              text: "whether fewer women than men study physics at college.",
            },
          ],
        },
        "23": {
          answer: "C",
          options: [
            { label: "A", text: "the teachers marked them in an unfair way." },
            {
              label: "B",
              text: "the male students expected them to do badly.",
            },
            {
              label: "C",
              text: "their test results were lower than the male students’.",
            },
          ],
        },
        "24": {
          answer: "C",
          options: [
            { label: "A", text: "what they enjoyed about studying physics." },
            { label: "B", text: "the successful experiences of other people." },
            {
              label: "C",
              text: "something that was important to them personally.",
            },
          ],
        },
        "25": {
          answer: "A",
          options: [
            { label: "A", text: "to reduce stress" },
            { label: "B", text: "to strengthen verbal ability" },
            { label: "C", text: "to encourage logical thinking" },
          ],
        },
        "26": {
          answer: "B",
          options: [
            { label: "A", text: "how few students managed to get A grades" },
            {
              label: "B",
              text: "the positive impact it had on physics results for women",
            },
            {
              label: "C",
              text: "the difference between male and female performance",
            },
          ],
        },
        "27": {
          answer: "C",
          options: [
            { label: "A", text: "the length of the writing task." },
            { label: "B", text: "the number of students who took part." },
            { label: "C", text: "the information the students were given." },
          ],
        },
        "28": {
          answer: "A",
          options: [
            { label: "A", text: "two different writing tasks." },
            { label: "B", text: "a writing task with an oral task." },
            { label: "C", text: "two different oral tasks." },
          ],
        },
        "29": {
          answer: "B",
          options: [
            {
              label: "A",
              text: "were most effective when done by all-women groups.",
            },
            {
              label: "B",
              text: "had no effect on the performance of men or women.",
            },
            {
              label: "C",
              text: "improved the results of men more than of women.",
            },
          ],
        },
        "30": {
          answer: "B",
          options: [
            { label: "A", text: "talk to a professor" },
            { label: "B", text: "observe a science class" },
            { label: "C", text: "look at the science timetable" },
          ],
        },
      },
    },

    // =========================================================================
    // SECTION 4: Ocean Biodiversity (New)
    // =========================================================================
    {
      section_id: "section-4",
      title: "Section 4",
      audio_path: "/section4.mpeg",
      instruction: "You should spend about 7-8 minutes on this section.",

      render_blocks: [
        { type: "header", content: "Questions 31-40" },
        {
          type: "instruction",
          content:
            "Complete the notes below.\nWrite ONE WORD ONLY for each answer.",
        },

        { type: "title", content: "Ocean Biodiversity" },

        // --- Sub-section: Biodiversity hotspots ---
        { type: "subtitle", content: "Biodiversity hotspots" },
        { type: "text", content: "• areas containing many different species" },
        {
          type: "text",
          content: "• important for locating targets for {{31}blanks}",
        },
        { type: "text", content: "• at first only identified on land" },

        // --- Sub-section: Boris Worm, 2005 ---
        { type: "subtitle", content: "Boris Worm, 2005" },
        {
          type: "text",
          content:
            "• identified hotspots for large ocean predators, e.g. sharks",
        },
        { type: "text", content: "• found the ocean hotspots:" },
        { type: "text", content: "  – were not always rich in {{32}blanks}" },
        {
          type: "text",
          content: "  – had higher temperatures at the {{33}blanks}",
        },
        {
          type: "text",
          content: "  – had sufficient {{34}blanks} in the water",
        },

        // --- Sub-section: Lisa Ballance, 2007 ---
        { type: "subtitle", content: "Lisa Ballance, 2007" },
        {
          type: "text",
          content: "• looked for hotspots for marine {{35}blanks}",
        },
        {
          type: "text",
          content: "• found these were all located where ocean currents meet",
        },

        // --- Sub-section: Census of Marine Life ---
        { type: "subtitle", content: "Census of Marine Life" },
        { type: "text", content: "• found new ocean species living:" },
        { type: "text", content: "  – under the {{36}blanks}" },
        { type: "text", content: "  – near volcanoes on the ocean floor" },

        // --- Sub-section: Global Marine Species Assessment ---
        { type: "subtitle", content: "Global Marine Species Assessment" },
        {
          type: "text",
          content: "• want to list endangered ocean species, considering:",
        },
        { type: "text", content: "  – population size" },
        { type: "text", content: "  – geographical distribution" },
        { type: "text", content: "  – rate of {{37}blanks}" },
        {
          type: "text",
          content:
            "• Aim: to assess 20,000 species and make a distribution {{38}blanks} for each one",
        },

        // --- Sub-section: Recommendations ---
        {
          type: "subtitle",
          content: "Recommendations to retain ocean biodiversity",
        },
        { type: "text", content: "• increase the number of ocean reserves" },
        {
          type: "text",
          content: "• establish {{39}blanks} corridors (e.g. for turtles)",
        },
        { type: "text", content: "• reduce fishing quotas" },
        {
          type: "text",
          content: "• catch fish only for the purpose of {{40}blanks}",
        },
      ],

      questions: {
        "31": { answer: "conservation" },
        "32": { answer: "food" }, // sometimes "foods" is accepted, but "food" is standard
        "33": { answer: "surface" },
        "34": { answer: "oxygen" },
        "35": { answer: "mammals" },
        "36": { answer: "ice" },
        "37": { answer: "decline" },
        "38": { answer: "map" },
        "39": { answer: "migration" },
        "40": { answer: "consumption" },
      },
    },
  ],
};
