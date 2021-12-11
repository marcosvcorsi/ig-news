import { query as q } from 'faunadb';
import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import { signIn } from 'next-auth/react';
import { fauna } from '../../../services/fauna';

export default NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'read:user'
        }
      }
    }),
  ],

  callbacks: {
    signIn: async ({ user, account, profile }) => {
      try {
        const { email } = user;

        const matchByEmail = q.Match(
          q.Index('user_by_email'),
          q.Casefold(email),
        )

        await fauna.query(
          q.If(
            q.Not(
              q.Exists(
                matchByEmail
              )
            ),
            q.Create(
              q.Collection('users'),
              { data: { email }}
            ),
            q.Get(
              matchByEmail
            )
          )
        )

        return true;
      } catch(error) {
        console.error(error);
        return false;
      }
    }
  }
})