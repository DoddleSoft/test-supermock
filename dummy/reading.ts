import { ReadingModule } from "@/helpers/reading";

export const readingModuleData = {
  module_id: "reading-cambridge-8-test-1",
  title: "Cambridge IELTS 8 - Academic Reading Test 1",
  duration_minutes: 60,
  passages: [
    // =========================================================================
    // PASSAGE 1
    // =========================================================================
    {
      passage_id: "passage-1",
      title: "Passage 1",
      heading: "THE SMART CARD",
      instruction:
        "You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.",
      passage_text: `A. The invention of the microchip in the 1960s revolutionised the computer industry. Microchips are also used in thousands of other products, including smart cards. These look and function like the familiar magnetic-stripe credit cards, but they have a microchip embedded inside them that can store information. The smart card was the brainchild of two French inventors, Roland Moreno and Michel Ugon, who developed the technology in the mid-1970s. The first cards were tested in several French cities in the early 1980s and the technology was subsequently adopted by banks throughout Europe. Smart cards are now a part of everyday life in Europe, where they are used for a wide range of purposes, including paying for public transport, making small purchases over the counter, and banking by telephone. The European Union has adopted the technology as the standard for all its future credit cards. Smart cards are only just beginning to be introduced in the United States, where the older magnetic-stripe technology is still the norm. The new technology is considered to be much more secure than the magnetic-stripe card, which is vulnerable to fraud. The microchip embedded in the smart card can be programmed to allow the cardholder to access many different systems. One card can be used for various types of banking transactions, for example, and as a phone card. It can also serve as an electronic purse, storing a cash balance for small purchases and recording phone and ATM transactions. It can also be used as a security pass to give the cardholder access to restricted areas.

B. The smart card may well replace keys, money, and identity cards in the future. In the United States, the Department of Defense has provided smart cards to its 4.3 million employees, and the Department of Energy is planning to do the same. Many of the nation's hospitals and health-care facilities are also adopting the technology.

C. One of the most significant uses of the smart card is in providing people with access to their own health records. In France, for example, everyone now has a smart card containing a complete medical history, which can be accessed immediately by a doctor or pharmacist. The card, which is the size of a credit card, has a microchip embedded in it that contains the patient's medical history, including allergies, blood type, and details of any current medical conditions. The card also contains information about the patient's health-insurance provider. The card can be used to store medical records, prescriptions, and details of medical appointments.

D. In the United States, the Health Insurance Portability and Accountability Act (HIPAA) is driving the demand for smart cards. The Act requires health-care providers to protect the privacy of patients' medical information and to take measures to protect the security of sensitive information. Smart cards are considered one of the best ways of meeting these requirements.

E. The technology is also being used to improve the security of the US passport card. The card is a wallet-sized document that can be used instead of the traditional passport booklet when US citizens cross the border by land or sea between the United States and Canada, Mexico, the Caribbean, or Bermuda. The card has a microchip embedded in it that contains a unique number linking the card to a government database containing the cardholder's personal information.

F. Smart cards are also used in public-transport systems around the world. In Hong Kong, for example, the Octopus card is used by millions of commuters every day. The card is a plastic smart card containing a microchip that can be loaded with cash and used to pay for travel on the city's underground railway system. The card can also be used on buses, ferries, and trams, and even in car parks and convenience stores.`,

      // 1. VISUAL BLOCKS: This is exactly what renders on the right side.
      // Syntax: {{QuestionNumber}Type}
      render_blocks: [
        // --- Section 1: True / False ---
        { type: "header", content: "Questions 1-7" },
        {
          type: "instruction",
          content:
            "Do the following statements agree with the information given in Reading Passage 1?",
        },
        {
          type: "text",
          content:
            "1. {{1}boolean} The smart card was developed by two French inventors in the 1960s.",
        },
        {
          type: "text",
          content:
            "2. {{2}boolean} The microchips in smart cards can store information.",
        },
        {
          type: "text",
          content:
            "3. {{3}boolean} The European Union wants all its citizens to use smart cards.",
        },
        {
          type: "text",
          content:
            "4. {{4}boolean} The US Department of Defense has provided smart cards to its employees.",
        },
        {
          type: "text",
          content:
            "5. {{5}boolean} The US Department of Energy has developed a smart card for its employees.",
        },
        {
          type: "text",
          content:
            "6. {{6}boolean} In France, people's medical records are stored on a smart card.",
        },
        {
          type: "text",
          content:
            "7. {{7}boolean} The Health Insurance Portability and Accountability Act requires health-care providers to protect patients' privacy.",
        },

        // --- Section 2: Notes Completion ---
        { type: "header", content: "Questions 8-13" },
        {
          type: "instruction",
          content:
            "Complete the notes below. Choose NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage for each answer.",
        },
        { type: "title", content: "THE SMART CARD" },

        { type: "subtitle", content: "Functions of smart cards" },
        { type: "text", content: "• store information" },
        {
          type: "text",
          content: "• allow the cardholder to access different systems",
        },

        { type: "subtitle", content: "Different uses of smart cards" },
        { type: "text", content: "• to make small purchases" },
        { type: "text", content: "• to record phone and ATM transactions" },
        { type: "text", content: "• as a security pass" },

        { type: "subtitle", content: "Use of smart cards in France" },
        {
          type: "text",
          content:
            "• to provide people with access to their own health records",
        },
        {
          type: "text",
          content: "• to store medical records and details about {{8}blanks}",
        },
        { type: "text", content: "• to store {{9}blanks}" },

        {
          type: "subtitle",
          content: "Use of smart cards in the United States",
        },
        {
          type: "text",
          content: "• to improve the security of the US passport card",
        },
        {
          type: "text",
          content:
            "• to provide a {{10}blanks} between the card and a government database",
        },

        { type: "subtitle", content: "Use of smart cards in Hong Kong" },
        {
          type: "text",
          content:
            "• to pay for travel on the city’s underground railway system",
        },
        {
          type: "text",
          content:
            "• to pay for travel on {{11}blanks}, {{12}blanks} and {{13}blanks}",
        },
      ],

      // 2. LOGIC DATA: Validations and Options
      questions: {
        "1": { answer: "FALSE", options: ["TRUE", "FALSE", "NOT GIVEN"] },
        "2": { answer: "TRUE", options: ["TRUE", "FALSE", "NOT GIVEN"] },
        "3": { answer: "NOT GIVEN", options: ["TRUE", "FALSE", "NOT GIVEN"] },
        "4": { answer: "TRUE", options: ["TRUE", "FALSE", "NOT GIVEN"] },
        "5": { answer: "NOT GIVEN", options: ["TRUE", "FALSE", "NOT GIVEN"] },
        "6": { answer: "TRUE", options: ["TRUE", "FALSE", "NOT GIVEN"] },
        "7": { answer: "TRUE", options: ["TRUE", "FALSE", "NOT GIVEN"] },
        "8": { answer: "medical appointments" },
        "9": { answer: "prescriptions" },
        "10": { answer: "unique number" },
        "11": { answer: "buses" },
        "12": { answer: "ferries" },
        "13": { answer: "trams" },
      },
    },

    // =========================================================================
    // PASSAGE 2
    // =========================================================================
    {
      passage_id: "passage-2",
      title: "Passage 2",
      instruction:
        "You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.",
      heading: "GENE THERAPY",
      passage_text: `A. Gene therapy is the introduction of genes into existing cells to prevent or cure a wide range of diseases. The most common form of gene therapy involves using DNA that encodes a functional, therapeutic gene to replace a mutated gene. Gene therapy was first conceptualised in 1972, with the authors urging caution before commencing human gene therapy studies. The first attempt, an unsuccessful one, at modifying human DNA was performed in 1980 by Martin Cline. The first successful nuclear gene transfer in humans, approved by the National Institutes of Health, was performed in May 1989. The first therapeutic use of gene transfer as well as the first direct insertion of human DNA into the nuclear genome was performed by French Anderson in a trial starting in September 1990. The first commercial gene therapy, Gendicine, was approved in China in 2003 for the treatment of certain cancers. In 2011, Neovasculgen was registered in Russia as the first-in-class gene-therapy drug for treatment of peripheral artery disease, including critical limb ischemia. In 2012, Glybera, a treatment for a rare inherited disorder, lipoprotein lipase deficiency, was approved by the European Commission.

B. Although the technology is still in its infancy, it has been used with some success. It is a potential therapy for a number of diseases (such as cystic fibrosis, sickle cell anaemia, adrenoleukodystrophy and haemophilia) as well as several inherited retinal diseases. Current gene therapy has primarily focused on treating individuals by targeting the therapy to somatic (body) cells, such as bone marrow cells. Gene therapy may be classified into the two following types:
Somatic gene therapy: In somatic gene therapy, the therapeutic genes are transferred into the somatic cells (cells that do not make sperm or eggs) of a patient. Any modifications and effects will be restricted to the individual patient only, and will not be inherited by the patient’s offspring or later generations. Somatic gene therapy represents mainstream basic and clinical research, in which therapeutic DNA is used to treat disease.
Germline gene therapy: In germline gene therapy, germ cells (sperm or eggs) are modified by the introduction of functional genes, which are ordinarily integrated into their genomes. The change due to therapy would therefore be heritable and would be passed on to later generations. In some jurisdictions, germline gene therapy is the only feasible option for some diseases; however, this option is fraught with many bio-ethical considerations. For the present, germline gene therapy is prohibited for application in human beings, at least for the foreseeable future, in most countries.

C. Gene therapy may be classified into two types, ex vivo and in vivo, on the basis of the method of delivery of genes. Ex vivo gene therapy involves the transfer of genes in cultured cells and reinsertion of the genetically altered cells back into the patient. In vivo gene therapy is the direct delivery of genes into the cells of a particular tissue in the body. The in vivo gene delivery can be divided into two categories: the therapeutic gene is directly injected into the body tissues; the therapeutic DNA is delivered to the target cells through the circulation.

D. Gene therapy uses sections of DNA (usually genes) to treat or prevent disease. The DNA is carefully selected to correct the effect of a mutated gene that is causing disease. The technique was first developed in 1972 but has, so far, had limited success in treating human diseases. For example, in 1999, 18-year-old Jesse Gelsinger died after undergoing gene therapy for ornithine transcarbamylase deficiency, and in 2002 it was reported that two children treated for X-linked severe combined immunodeficiency (X-SCID) in a clinical trial in 1999 had developed leukaemia. However, more than 1,800 gene therapy clinical trials have been conducted since the technique was first developed. Gene therapy can be used to modify cells inside or outside the body. When it’s done inside the body, a doctor will inject the vector carrying the gene directly into the patient. This method is useful when only certain tissues require correction. When it’s done outside the body, doctors will take a sample of the patient’s cells and expose them to the vector in a laboratory. The corrected cells are then returned to the patient. This approach is more useful when only a few cells need to be corrected.

E. Gene therapy has the potential to eliminate and prevent hereditary diseases such as cystic fibrosis and is a possible cure for heart disease, AIDS and cancer. The technology is still in its infancy. If the defects in the gene are corrected, these diseases could be treated. Gene therapy could have the potential to cure many genetic disorders. However, there are concerns that the wide range use of gene therapy in human beings is not safe.`,

      render_blocks: [
        // --- Questions 14-18: Information Matching ---
        { type: "header", content: "Questions 14-18" },
        {
          type: "instruction",
          content:
            "Reading Passage 2 has five sections, A-E. Which section contains the following information? Write the correct letter, A-E, in boxes 14-18 on your answer sheet. NB: You may use any letter more than once.",
        },

        {
          type: "text",
          content:
            "14. {{14}dropdown} a reference to a person who resisted the use of gene therapy on humans",
        },
        {
          type: "text",
          content:
            "15. {{15}dropdown} a reference to the early failure of a gene therapy trial",
        },
        {
          type: "text",
          content:
            "16. {{16}dropdown} a reference to different methods of delivering gene therapy.",
        },
        {
          type: "text",
          content:
            "17. {{17}dropdown} a reference to the ethical concerns surrounding inheritable gene therapy.",
        },
        {
          type: "text",
          content:
            "18. {{18}dropdown} mention of the total recorded attempts to apply gene therapy in clinical research.",
        },

        // --- Questions 19-22: Summary Completion ---
        { type: "header", content: "Questions 19-22" },
        {
          type: "instruction",
          content: "Choose ONE WORD ONLY from the passage for each answer.",
        },
        { type: "title", content: "TYPES OF GENE THERAPY" },
        {
          type: "text",
          content:
            "Gene therapy can be classified as either somatic or germline. In somatic gene therapy, the {{19}blanks} cells of a patient are targeted for gene replacement. The effects of the therapy will not be passed down to future {{20}blanks}.",
        },
        {
          type: "text",
          content:
            "However, in germline gene therapy, the DNA of a patient’s sperm or egg cells is altered. This means that any changes will be passed down to future generations. Although this type of gene therapy is not permitted in humans in most countries, it may be the only possible cure for people with certain {{21}blanks}.",
        },
        {
          type: "text",
          content:
            "In addition, gene therapy can be classified as either ex vivo or in vivo. In ex vivo gene therapy, the genes are altered outside the patient’s body before the {{22}blanks} into the patient. In vivo gene therapy involves injecting the therapeutic DNA directly into the patient’s body.",
        },

        // --- Questions 23-26: True/False/Not Given ---
        { type: "header", content: "Questions 23-26" },
        {
          type: "instruction",
          content:
            "Do the following statements agree with the information given in Reading Passage 2?",
        },

        {
          type: "text",
          content:
            "23. {{23}boolean} The first gene therapy trial on humans was unsuccessful.",
        },
        {
          type: "text",
          content:
            "24. {{24}boolean} So far, gene therapy has only been used on adults.",
        },
        {
          type: "text",
          content:
            "25. {{25}boolean} X-SCID is more common in boys than girls.",
        },
        {
          type: "text",
          content:
            "26. {{26}boolean} The corrected cells are then returned to the patient.",
        },
      ],

      questions: {
        // Dropdown Matching
        "14": { answer: "A", options: ["A", "B", "C", "D", "E"] }, // Mentions authors urging caution
        "15": { answer: "A", options: ["A", "B", "C", "D", "E"] }, // First attempt unsuccessful in 1980
        "16": { answer: "C", options: ["A", "B", "C", "D", "E"] }, // Ex vivo and In vivo
        "17": { answer: "B", options: ["A", "B", "C", "D", "E"] }, // Bio-ethical considerations
        "18": { answer: "D", options: ["A", "B", "C", "D", "E"] }, // More than 1,800 trials

        // Fill in Blanks
        "19": { answer: "somatic" },
        "20": { answer: "generations" },
        "21": { answer: "diseases" },
        "22": { answer: "reinsertion" },

        // True/False/Not Given
        "23": { answer: "TRUE", options: ["TRUE", "FALSE", "NOT GIVEN"] },
        "24": { answer: "FALSE", options: ["TRUE", "FALSE", "NOT GIVEN"] }, // Children were treated (Jesse Gelsinger, etc.)
        "25": { answer: "NOT GIVEN", options: ["TRUE", "FALSE", "NOT GIVEN"] },
        "26": { answer: "TRUE", options: ["TRUE", "FALSE", "NOT GIVEN"] },
      },
    },

    // =========================================================================
    // PASSAGE 3
    // =========================================================================
    {
      passage_id: "passage-3",
      title: "Passage 3",
      heading: "THE MYTH OF LEARNING STYLES",
      instruction:
        "You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.",
      passage_text: `The idea that teaching methods should match a student’s particular learning style — their personal way of learning — is popular with teachers and students alike. But the evidence suggests it may not be helpful.
The concept of learning styles is one of the most influential — and widely criticized — theories in education. It is the idea that each person finds it easier to learn through a particular method of instruction. Some people, for example, are thought to learn better when they’re taught visually; others, when instruction is auditory, or through movement, and so on.
The idea is popular in part because it reflects the intuition of teachers and students. Everyone knows from personal experience that some kinds of learning feel easier than others, and that they may prefer one way of learning over another. And it is also popular because it claims to be based on science. The idea of learning styles was developed in the 1970s, as psychologists and educational theorists were trying to understand how people learn. The idea that different people learn information in different ways was appealing, and it soon became clear that many people had strong preferences about how they liked information to be presented. In a typical research study, one group of students might be classified as ‘visual learners’, while another group would be classified as ‘auditory learners’. All the students would then be asked to learn something, with half the visual learners being taught visually, and half being taught aurally. The auditory learners would also be split into the two groups. If the theory was correct, the visual learners should do better when taught visually, and the auditory learners should do better when taught aurally.
But that’s not what psychologists found. As early as 2004, a review of the evidence by cognitive scientists found that the great majority of studies did not provide any evidence supporting the idea that matching the material to a student’s particular learning style was helpful. More recently, a team of psychologists led by Daniel Willingham at the University of Virginia has examined the evidence for learning styles again. They found that the vast majority of studies either found no evidence for the theory, or actually contradicted it. As the researchers point out, people may have preferences about how they learn, but that doesn’t mean that they will learn better when the teaching matches those preferences.
There are several possible explanations for these findings. One is that some students might not actually have a ‘style’ that is strong enough to affect their learning. Another possibility is that students do have preferences about how they learn, but these preferences don’t affect their learning. A third possibility is that students do have preferences, and these preferences do affect their learning, but only because they have learned less well through other methods in the past.
But the most likely explanation is that different ways of learning are useful for learning different things. For example, learning to drive a car involves a mix of visual learning (such as watching the instructor), auditory learning (listening to instructions), and hands-on learning (actually driving the car). In a 2009 article in the journal Psychological Science in the Public Interest, psychologists Harold Pashler, Mark McDaniel, Doug Rohrer and Robert Bjork argued that the learning-styles approach is not only unsupported by science, but may actually be harmful, because it leads teachers to teach students in ways that are not very effective. For example, a student who is a ‘visual learner’ might be encouraged to learn only through visual materials, and never to practice learning by listening, reading or acting.
The idea of learning styles is also harmful because it can give students the impression that they have fixed, or fixed amounts of, intelligence. In recent years, a great deal of research has shown that people’s attitudes to learning can have a large impact on how much they learn. For example, students who believe that intelligence is fixed, and that they are either smart or stupid and there is nothing they can do about it, tend to do less well than students who believe that intelligence can change, and that they can become smarter by working hard at their studies. Similarly, students who have been told that they are ‘visual learners’ might put less effort into tasks that are based on reading or listening. This is particularly worrying because research has shown that students who use a mix of learning methods often learn more effectively than those who stick to their ‘style’.
Despite the lack of evidence for learning styles, the idea is still very popular. A 2014 study of more than 400 teachers in the UK and the Netherlands found that more than 90 percent of them believed that people learn better if they are taught in their preferred learning style, and that the majority of them used learning styles as a method of instruction. In the US, a 2017 survey of more than 300 teachers found that 96 percent of them agreed with the idea of learning styles, and 24 percent of them used it to guide their teaching.
The idea of learning styles is also popular among students. In a 2018 study, researchers asked more than 600 students in the US about their beliefs about learning. They found that 93 percent of them agreed with the idea of learning styles, and that 78 percent of them said that they had a particular learning style.
The evidence is clear: matching teaching to a student’s particular learning style is unlikely to lead to better learning. It may in fact be holding students back.`,

      render_blocks: [
        // --- Questions 27-31: Yes/No/Not Given ---
        { type: "header", content: "Questions 27-31" },
        {
          type: "instruction",
          content:
            "Do the following statements agree with the claims of the writer in Reading Passage 3?",
        },

        {
          type: "text",
          content:
            "27. {{27}boolean} Teachers and students’ personal experiences contribute to the popularity of the learning styles concept.",
        },
        {
          type: "text",
          content:
            "28. {{28}boolean} Research into learning styles was popular in the 1970s.",
        },
        {
          type: "text",
          content:
            "29. {{29}boolean} Psychologists found evidence for the idea of learning styles as early as 2004.",
        },
        {
          type: "text",
          content:
            "30. {{30}boolean} The team of psychologists led by Daniel Willingham found evidence for the idea of learning styles.",
        },
        {
          type: "text",
          content:
            "31. {{31}boolean} Students may learn better when they are taught using methods they are not familiar with.",
        },

        // --- Questions 32-35: Summary Completion with BOX ---
        { type: "header", content: "Questions 32-35" },
        {
          type: "instruction",
          content:
            "Complete the summary using the list of words, A-F, below. Write the correct letter, A-F, in boxes 32-35 on your answer sheet.",
        },
        { type: "title", content: "EXPLANATIONS FOR THE FINDINGS" },

        // The Box Data
        {
          type: "box",
          content:
            "A. harmful\nB. ability\nC. hands-on learning\nD. learning\nE. preference\nF. useful",
        },

        {
          type: "text",
          content:
            "One explanation is that some students might not have a strong enough {{32}dropdown} to affect their learning. Another possibility is that students may have preferences about how they learn, but these preferences don’t affect their {{33}dropdown}.",
        },
        {
          type: "text",
          content:
            "A third possibility is that students’ preferences do affect their learning, but only because they have learned less well through other methods in the past.",
        },
        {
          type: "text",
          content:
            "The most likely explanation is that different ways of learning are useful for learning different things. For example, learning to drive a car involves visual learning, auditory learning and {{34}dropdown}.",
        },
        {
          type: "text",
          content:
            "The learning-styles approach is not only unsupported by science, but may actually be {{35}dropdown}.",
        },

        // --- Questions 36-40: Sentence Completion ---
        { type: "header", content: "Questions 36-40" },
        {
          type: "instruction",
          content:
            "Complete the sentences below. Choose ONE WORD ONLY from the passage for each answer.",
        },

        {
          type: "text",
          content:
            "36. The idea of learning styles can give students the wrong idea about their level of {{36}blanks} ;",
        },
        {
          type: "text",
          content:
            "37. Students who believe that intelligence is {{37}blanks} tend to do better than other students.",
        },
        {
          type: "text",
          content:
            "38. Students who have been told that they are {{38}blanks} learners might not try so hard to learn by reading or listening.",
        },
        {
          type: "text",
          content:
            "39. Research has shown that students who use a {{39}blanks} of learning methods often learn more effectively.",
        },
        {
          type: "text",
          content:
            "40. In a 2018 study, 78 percent of students said that they had a particular {{40}blanks} .",
        },
      ],

      questions: {
        "27": { answer: "YES", options: ["YES", "NO", "NOT GIVEN"] },
        "28": { answer: "NOT GIVEN", options: ["YES", "NO", "NOT GIVEN"] },
        "29": { answer: "NO", options: ["YES", "NO", "NOT GIVEN"] },
        "30": { answer: "NO", options: ["YES", "NO", "NOT GIVEN"] },
        "31": { answer: "NOT GIVEN", options: ["YES", "NO", "NOT GIVEN"] },

        // Dropdown box choices
        "32": { answer: "B", options: ["A", "B", "C", "D", "E", "F"] }, // Ability/Preference check
        "33": { answer: "D", options: ["A", "B", "C", "D", "E", "F"] },
        "34": { answer: "C", options: ["A", "B", "C", "D", "E", "F"] },
        "35": { answer: "A", options: ["A", "B", "C", "D", "E", "F"] },

        // One word blanks
        "36": { answer: "intelligence" },
        "37": { answer: "change" }, // or "changeable" based on strict text "can change" -> often IELTS allows 'change'
        "38": { answer: "visual" },
        "39": { answer: "mix" },
        "40": { answer: "style" },
      },
    },
  ],
};
