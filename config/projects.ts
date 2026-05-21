import { ValidCategory, ValidExpType, ValidSkills } from "./constants";

interface PagesInfoInterface {
  title: string;
  imgArr: string[];
  description?: string;
}

interface DescriptionDetailsInterface {
  paragraphs: string[];
  bullets: string[];
}

export interface ProjectInterface {
  id: string;
  type: ValidExpType;
  companyName: string;
  category: ValidCategory[];
  shortDescription: string;
  websiteLink?: string;
  githubLink?: string;
  techStack: ValidSkills[];
  startDate: Date;
  endDate: Date;
  companyLogoImg: any;
  descriptionDetails: DescriptionDetailsInterface;
  pagesInfoArr: PagesInfoInterface[];
}

export const Projects: ProjectInterface[] = [
  {
    id: "ecommerce-hot-sauce",
    companyName: "Ecommerce Hot Sauce",
    type: "Personal",
    category: ["Full Stack", "Web Dev"],
    shortDescription:
      "Ecommerce store built with Vue, Nuxt, Firebase, Contentful CMS and Stripe.",
    websiteLink: "https://e-commerce-hot-sauce.vercel.app/",
    githubLink: "https://github.com/CalGrimes/ECommerce-HotSauce",
    techStack: ["Vue.js", "Firebase", "AWS"],
    startDate: new Date("2023-01-01"),
    endDate: new Date("2023-06-01"),
    companyLogoImg: "/projects/ecommerce-hot-sauce/ecommerce-hotsauce.png",
    pagesInfoArr: [
      {
        title: "Ecommerce Hot Sauce",
        description:
          "Ecommerce store built with Vue, Nuxt, Firebase, Contentful CMS and Stripe.",
        imgArr: ["/projects/ecommerce-hot-sauce/ecommerce-hotsauce.png"],
      },
    ],
    descriptionDetails: {
      paragraphs: [
        "Ecommerce store built with Vue, Nuxt, Firebase, Contentful CMS and Stripe.",
        "Also deployed this as a static site to AWS with S3, API Gateway and Lambda (http://consulting-556567.s3-website.eu-west-2.amazonaws.com/).",
      ],
      bullets: [
        "Ecommerce store built with Vue, Nuxt, Firebase",
        "Deployed static site to AWS S3, API Gateway and Lambda",
      ],
    },
  },
  {
    id: "grafana-loki",
    companyName: "Grafana Loki Logging With Python",
    type: "Personal",
    category: ["Backend"],
    shortDescription:
      "A medium article project that demonstrates logging from a Python application to Loki using Docker Compose. It includes services for Loki, Grafana, Minio, and a custom Python log generator.",
    websiteLink:
      "https://medium.com/@cal.grimes/send-log-data-to-loki-from-python-22dfd0c6b45c",
    githubLink: "https://github.com/CalGrimes/python-log-to-loki",
    techStack: ["Python", "Docker"],
    startDate: new Date("2023-01-01"),
    endDate: new Date("2023-06-01"),
    companyLogoImg: "/projects/grafana-loki/projects-loki.png",
    pagesInfoArr: [
      {
        title: "Grafana Loki Logging",
        description:
          "A medium article project that demonstrates logging from a Python application to Loki using Docker Compose.",
        imgArr: ["/projects/grafana-loki/projects-loki.png"],
      },
    ],
    descriptionDetails: {
      paragraphs: [
        "A medium article project that demonstrates logging from a Python application to Loki using Docker Compose.",
        "It includes services for Loki, Grafana, Minio, and a custom Python log generator.",
      ],
      bullets: [
        "Demonstrates logging from Python application to Loki",
        "Uses Docker Compose for Loki, Grafana, Minio services",
      ],
    },
  },
  {
    id: "elk-stack-aws",
    companyName: "ELK Stack on AWS",
    type: "Personal",
    category: ["Backend"],
    shortDescription:
      "A medium article project that demonstrates setting up an ELK stack on AWS using Ubuntu VMs. It includes services for Elasticsearch, Kibana, Logstash.",
    websiteLink:
      "https://medium.com/@cal.grimes/quick-start-elasticsearch-logstash-and-kibana-elk-stack-on-aws-e4a4604e9833",
    githubLink: "https://github.com/CalGrimes/ElasticSearch-AWS-VM-Ubuntu",
    techStack: ["AWS"],
    startDate: new Date("2023-01-01"),
    endDate: new Date("2023-06-01"),
    companyLogoImg: "/projects/elk-stack-aws/projects-elk.png",
    pagesInfoArr: [
      {
        title: "ELK Stack on AWS",
        description:
          "A medium article project that demonstrates setting up an ELK stack on AWS using Ubuntu VMs.",
        imgArr: ["/projects/elk-stack-aws/projects-elk.png"],
      },
    ],
    descriptionDetails: {
      paragraphs: [
        "A medium article project that demonstrates setting up an ELK stack on AWS using Ubuntu VMs.",
        "It includes services for Elasticsearch, Kibana, Logstash.",
      ],
      bullets: [
        "Sets up ELK stack on AWS using Ubuntu VMs",
        "Includes Elasticsearch, Kibana, Logstash services",
      ],
    },
  },
];

export const featuredProjects = Projects.slice(0, 3);
