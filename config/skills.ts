import { Icons } from "@/components/common/icons";

export interface skillsInterface {
  name: string;
  description: string;
  rating: number;
  icon: any;
}

export const skillsUnsorted: skillsInterface[] = [
  {
    name: "AWS",
    description:
      "Build and deploy scalable, reliable, and secure applications on Amazon Web Services.",
    rating: 0,
    icon: Icons.amazonaws,
  },
  {
    name: "Python",
    description:
      "Develop robust backend services, automated logging tools, and data processing scripts.",
    rating: 0,
    icon: Icons.code,
  },
  {
    name: "Java",
    description:
      "Build high-performance applications and manipulate complex data structures.",
    rating: 0,
    icon: Icons.code,
  },
  {
    name: "Vue.js",
    description:
      "Craft interactive user interfaces and responsive single-page applications.",
    rating: 0,
    icon: Icons.javascript,
  },
  {
    name: "Docker",
    description:
      "Containerize applications for consistent environments and simplified deployments.",
    rating: 0,
    icon: Icons.server,
  },
  {
    name: "SQL",
    description:
      "Manage and organize relational databases efficiently for data-driven applications.",
    rating: 0,
    icon: Icons.database,
  },
  {
    name: "Azure",
    description:
      "Leverage Microsoft's cloud computing platform for enterprise solutions.",
    rating: 0,
    icon: Icons.cloud,
  },
  {
    name: "Terraform",
    description:
      "Provision and manage infrastructure as code for reliable cloud deployments.",
    rating: 0,
    icon: Icons.cloud,
  },
  {
    name: "Kafka",
    description:
      "Build real-time data pipelines and streaming apps with distributed event streaming.",
    rating: 0,
    icon: Icons.server,
  },
  {
    name: "Firebase",
    description:
      "Quickly build scalable backends with real-time databases and authentication.",
    rating: 0,
    icon: Icons.database,
  },
  {
    name: ".NET",
    description:
      "Develop robust enterprise applications and services using the .NET framework.",
    rating: 0,
    icon: Icons.code,
  },
  {
    name: "Oracle",
    description:
      "Manage large-scale enterprise databases and applications.",
    rating: 0,
    icon: Icons.database,
  },
  {
    name: "Salesforce",
    description:
      "Integrate and customize enterprise CRM solutions.",
    rating: 0,
    icon: Icons.cloud,
  },
  {
    name: "Data Engineering",
    description:
      "Design and build scalable data pipelines, ETL processes, and analytics architectures.",
    rating: 0,
    icon: Icons.database,
  },
  {
    name: "Solution Architecture",
    description:
      "Design high-level system architectures and guide enterprise cloud adoption.",
    rating: 0,
    icon: Icons.server,
  },
];

export const skills = skillsUnsorted
  .slice()
  .sort((a, b) => b.rating - a.rating);

export const featuredSkills = skills.slice(0, 6);
