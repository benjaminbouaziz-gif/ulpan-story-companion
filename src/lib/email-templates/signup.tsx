import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

import { brand, button, code, container, footer, h1, link, main, text, wordmark } from "./theme";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
  token?: string;
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  token,
}: SignupEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez votre adresse pour ouvrir les contenus du livre</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>{siteName}</Text>
        <Heading style={h1}>Confirmez votre adresse</Heading>
        <Text style={text}>
          Vous avez demandé l’accès aux contenus offerts avec votre livre. Confirmez l’adresse{" "}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>{" "}
          en ouvrant le lien ci-dessous.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Ouvrir mon compagnon
        </Button>
        {token ? (
          <>
            <Text style={{ ...text, margin: "28px 0 8px", color: brand.muted, fontSize: "14px" }}>
              Si le lien ne fonctionne pas, saisissez ce code sur la page d’activation :
            </Text>
            <Text style={code}>{token}</Text>
          </>
        ) : null}
        <Text style={footer}>
          Si vous n’êtes pas à l’origine de cette demande, ignorez ce courrier.{" "}
          <Link href={siteUrl} style={link}>
            {siteUrl.replace(/^https?:\/\//, "")}
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default SignupEmail;
