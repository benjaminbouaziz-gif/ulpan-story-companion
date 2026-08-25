import * as React from "react";

import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

import { code, container, footer, h1, main, text, wordmark } from "./theme";

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>Ulpan Story</Text>
        <Heading style={h1}>Votre code de vérification</Heading>
        <Text style={text}>Saisissez ce code pour confirmer votre identité :</Text>
        <Text style={code}>{token}</Text>
        <Text style={footer}>
          Ce code expire après un court délai. Si vous n’avez rien demandé, ignorez ce courrier.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ReauthenticationEmail;
