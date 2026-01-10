export const writingModuleData = {
  module_id: "writing-cambridge-generic-test-1",
  title: "Cambridge IELTS - Writing Test 1",
  module_type: "writing",
  duration_minutes: 60,
  tasks: [
    // =========================================================================
    // TASK 1: Report / Chart Analysis
    // =========================================================================
    {
      task_id: "task-1",
      title: "Writing Task 1",
      duration_recommendation: 20, // Minutes
      word_count_min: 150,
      render_blocks: [
        {
          type: "instruction",
          content:
            "You should spend about 20 minutes on this task and a minimum of 150 words.",
        },
        {
          type: "text",
          content:
            "The chart below shows the donations given to six different types of charity by one company from 2012 to 2014.",
        },
        // --- The Visual Prompt (Task 1 always has a diagram/chart) ---
        {
          type: "image",
          content: "/writing-image.png", // Placeholder path
          alt: "Bar chart showing donations to six charity types (2012-2014)",
        },
        {
          type: "text",
          content:
            "Summarize the information by selecting and reporting the main features and make comparisons where relevant.",
        },

        // --- The Input Area ---
        {
          type: "editor",
          label: "Your Answer",
          placeholder: "Type your report here...",
        },
      ],
    },

    // =========================================================================
    // TASK 2: Essay
    // =========================================================================
    {
      task_id: "task-2",
      title: "Writing Task 2",
      duration_recommendation: 40, // Minutes
      word_count_min: 250,

      render_blocks: [
        {
          type: "instruction",
          content:
            "You should spend about 40 minutes on this task and write at least 250 words..",
        },
        // --- The Topic/Prompt ---
        {
          type: "box", // Using 'box' adds visual weight to the prompt topic
          content:
            "In the future all cars, buses and trucks will be driverless. The only people travelling inside these vehicles will be passengers.\n\nDo you think the advantages of driverless vehicles outweigh the disadvantages?",
        },
        {
          type: "text",
          content:
            "Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
        },

        // --- The Input Area ---
        {
          type: "editor",
          label: "Your Essay",
          placeholder: "Type your essay here...",
          min_words: 250,
        },
      ],
    },
  ],
};
