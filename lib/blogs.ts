import fs from "fs";
import path from "path";

import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import { builder } from "@builder.io/sdk";

if (process.env.NEXT_PUBLIC_BUILDER_API_KEY) {
  builder.init(process.env.NEXT_PUBLIC_BUILDER_API_KEY);
}

const BLOGS_DIR = path.join(process.cwd(), "content/blogs");

export interface BlogFrontmatter {
  title: string;
  date: string;
  description: string;
  tags: string[];
  coverImage?: string;
  readingTime?: number;
  featured?: boolean;
  url?: string;
}

export interface BlogMeta extends BlogFrontmatter {
  slug: string;
  url?: string;
}

export interface BlogPost extends BlogMeta {
  contentHtml: string;
}

function ensureBlogsDir() {
  if (!fs.existsSync(BLOGS_DIR)) {
    fs.mkdirSync(BLOGS_DIR, { recursive: true });
  }
}

/** Returns all blog slugs (file names without .md) */
export function getAllBlogSlugs(): string[] {
  ensureBlogsDir();
  return fs
    .readdirSync(BLOGS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

/** Returns metadata for all blogs, sorted newest first */
export async function getAllBlogsMeta(): Promise<BlogMeta[]> {
  ensureBlogsDir();
  const slugs = getAllBlogSlugs();

  const localBlogs = slugs.map((slug) => {
    const filePath = path.join(BLOGS_DIR, `${slug}.md`);
    const raw = fs.readFileSync(filePath, "utf8");
    const { data } = matter(raw);
    return {
      slug,
      ...(data as BlogFrontmatter),
    } as BlogMeta;
  });

  let externalBlogs: BlogMeta[] = [];
  try {
    if (process.env.NEXT_PUBLIC_BUILDER_API_KEY) {
      builder.init(process.env.NEXT_PUBLIC_BUILDER_API_KEY);
    }
    const externalData = await builder.getAll("external-articles", {
      options: {
        includeUnpublished: process.env.NODE_ENV === "development",
        includeRefs: true,
      },
      cacheSeconds: 5,
      prerender: false,
    });

    externalBlogs = externalData.map((post: any) => {
      const data = post.data;
      return {
        slug: post.id || data?.id || "",
        title: data?.title || "",
        date: data?.date || new Date().toISOString(),
        description: data?.excerpt || "",
        tags: data?.category ? [data.category] : [],
        coverImage: data?.thumbnail || "",
        readingTime: estimateReadingTime(data?.excerpt || ""),
        url: data?.url || "",
      };
    });
  } catch (error) {
    console.error("Error fetching blogs from Builder.io:", error);
  }

  const allBlogs = [...localBlogs, ...externalBlogs];

  return allBlogs.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/** Returns full blog post (metadata + parsed HTML content) for a given slug */
export async function getBlogPost(slug: string): Promise<BlogPost> {
  const filePath = path.join(BLOGS_DIR, `${slug}.md`);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const processed = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content);

  const contentHtml = processed.toString();

  return {
    slug,
    ...(data as BlogFrontmatter),
    contentHtml,
  };
}

/** Returns the featured blogs (marked featured: true), falling back to the latest 3 */
export async function getFeaturedBlogs(): Promise<BlogMeta[]> {
  const all = await getAllBlogsMeta();
  const featured = all.filter((b) => b.featured);
  return featured.length > 0 ? featured.slice(0, 3) : all.slice(0, 3);
}

/** Estimates reading time from raw markdown content */
export function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}
