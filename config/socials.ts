import { Icons } from "@/components/common/icons";

interface SocialInterface {
  name: string;
  username: string;
  icon: any;
  link: string;
}

export const SocialLinks: SocialInterface[] = [
  {
    name: "Github",
    username: "@calgrimes",
    icon: Icons.gitHub,
    link: "https://github.com/calgrimes",
  },
  {
    name: "LinkedIn",
    username: "Cal Grimes",
    icon: Icons.linkedin,
    link: "https://www.linkedin.com/in/calgrimes",
  },
  {
    name: "Gmail",
    username: "[EMAIL_ADDRESS]",
    icon: Icons.gmail,
    link: "mailto:contact@calgrimes.co.uk",
  },
];
