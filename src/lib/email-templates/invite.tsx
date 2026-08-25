import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

import { button, container, footer, h1, main, text, wordmark } from "./theme";

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Vous êtes invité sur {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>{siteName}</Text>
        <Heading style={h1}>Vous êtes invité</Heading>
        <Text style={text}>
          Ouvrez le lien ci-dessous pour créer votre accès et rejoindre {siteName}.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accepter l’invitation
        </Button>
        <Text style={footer}>
          Si cette invitation ne vous concerne pas, ignorez ce courrier.{" "}
          {siteUrl.replace(/^https?:\/\//, "")}
        </Text>
      </Container>
    </Body>
  </Html>
);

export default InviteEmail;
