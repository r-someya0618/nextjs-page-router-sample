import { useEffect } from 'react';
import { Client } from '@notionhq/client';
import { GetStaticProps, NextPage } from 'next';
import styles from '../styles/Home.module.css';
import dayjs from 'dayjs';
import prism from 'prismjs';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export type Content =
  | {
      type: 'paragraph' | 'quote' | 'heading_2' | 'heading_3';
      text: string | null;
    }
  | {
      type: 'code';
      text: string | null;
      language: string | null;
    };

export type Post = {
  id: string;
  title: string | null;
  slug: string | null;
  createdTs: string | null;
  lastEditedTs: string | null;
  contents: Content[];
};

type StaticProps = {
  posts: Post[];
};

export const getStaticProps: GetStaticProps<StaticProps> = async () => {
  const database = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID || '',
    filter: {
      and: [
        {
          property: 'Published',
          checkbox: {
            equals: true,
          },
        },
      ],
    },
    sorts: [
      {
        timestamp: 'created_time',
        direction: 'descending',
      },
    ],
  });
  const posts: Post[] = [];
  const blockResponses = await Promise.all(
    database.results.map((page) => {
      return notion.blocks.children.list({
        block_id: page.id,
      });
    })
  );

  // const page = database.results[0];
  // // pageがない場合
  // if (!page) {
  //   return {
  //     props: {
  //       post: null,
  //     },
  //   };
  // }
  database.results.forEach((page, index) => {
    // propertiesがない（PartialPageObjectResponse型の場合）
    if (!('properties' in page)) {
      posts.push({
        id: page.id,
        title: null,
        slug: null,
        createdTs: null,
        lastEditedTs: null,
        contents: [],
      });
      return;
    }
    // pageはPageObjectResponse
    let title: string | null = null;
    if (page.properties['Name'].type === 'title') {
      title = page.properties['Name'].title[0]?.plain_text ?? null;
    }
    let slug: string | null = null;
    if (page.properties['Slug'].type === 'rich_text') {
      slug = page.properties['Slug'].rich_text[0]?.plain_text ?? null;
    }

    const blocks = blockResponses[index];
    const contents: Content[] = [];

    blocks.results.forEach((block) => {
      if (!('type' in block)) {
        return;
      }
      switch (block.type) {
        case 'paragraph':
          contents.push({
            type: 'paragraph',
            text: block.paragraph.rich_text[0]?.plain_text ?? null,
          });
          break;
        case 'heading_2':
          contents.push({
            type: 'heading_2',
            text: block.heading_2.rich_text[0]?.plain_text ?? null,
          });
          break;
        case 'heading_3':
          contents.push({
            type: 'heading_3',
            text: block.heading_3.rich_text[0]?.plain_text ?? null,
          });
          break;
        case 'quote':
          contents.push({
            type: 'quote',
            text: block.quote.rich_text[0]?.plain_text ?? null,
          });
          break;
        case 'code':
          contents.push({
            type: 'code',
            text: block.code.rich_text[0]?.plain_text ?? null,
            language: block.code.language,
          });
          break;
      }
    });

    posts.push({
      id: page.id,
      title,
      slug,
      createdTs: page.created_time,
      lastEditedTs: page.last_edited_time,
      contents,
    });
  });

  console.log(posts);
  return {
    props: { posts },
  };
};

const Home: NextPage<StaticProps> = ({ posts }) => {
  useEffect(() => {
    prism.highlightAll();
  }, []);

  return (
    <div className={styles.wrapper}>
      {posts.map((post) => (
        <div className={styles.post} key={post.id}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.timestampWrapper}>
            <div className={styles.timestamp}>
              作成日時 {dayjs(post.createdTs).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            <div className={styles.timestamp}>
              更新日時 {dayjs(post.lastEditedTs).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
          <div>
            {post.contents.map((content, index) => {
              const key = `${post.id}_${index}`;
              switch (content.type) {
                case 'heading_2':
                  return (
                    <h2 key={key} className={styles.heading2}>
                      {content.text}
                    </h2>
                  );
                case 'heading_3':
                  return (
                    <h3 key={key} className={styles.heading3}>
                      {content.text}
                    </h3>
                  );
                case 'paragraph':
                  return (
                    <h3 key={key} className={styles.paragraph}>
                      {content.text}
                    </h3>
                  );
                case 'code':
                  return (
                    <pre
                      key={key}
                      className={`${styles.code} lang-${content.language} `}
                    >
                      <code>{content.text}</code>
                    </pre>
                  );
                case 'quote':
                  return (
                    <blockquote key={key} className={`${styles.quote}`}>
                      {content.text}
                    </blockquote>
                  );
              }
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Home;
